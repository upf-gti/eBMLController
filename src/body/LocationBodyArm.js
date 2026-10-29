import * as THREE from 'three';
import { EBMLC } from "../Core.js";
import { E_FLAG_SYMMETRY_NONE, findIndexOfBone, stringToDirection } from '../Utils.js';


const E_LOCATIONBODYARM_MODE_UPDATE = 1; // always update target/default real location 
const E_LOCATIONBODYARM_MODE_UPDATEUNTILCONTACT = 2;  // updates target real location until it reaches peak. Then it hardcodes the position in world space. If shift=true, the default will pick this hardcoded value 
const E_LOCATIONBODYARM_MODE_FIXED = 3;
const E_LOCATIONBODYARM_MODE_NEUTRAL = 4;

// LocationBodyArm interpolates between locstates
function makeLocState () {
    return {
        loc: null, // location three.object
        sloc: null, // second location three.object
        distance: 0, // [0,1] arm length
        displace: new THREE.Vector3(),
        contactFinger: null,
        mode: E_LOCATIONBODYARM_MODE_UPDATE,
        fixedPosition: new THREE.Vector3(), // used for neutral, current and updateuntilcontact
        isShift: false // mainly used for trg
    }
}

function copyLocState(src, trg){
    let d = trg.displace;
    let f = trg.fixedPosition;
    Object.assign(trg, src);
    trg.displace = d.copy(src.displace);
    trg.fixedPosition = f.copy(src.fixedPosition)
}

class LocationBodyArm {
    constructor( config, skeleton, isLeftHand = false ) {
        this._tempV3_0 = new THREE.Vector3();
        this._tempV3_1 = new THREE.Vector3();
        this._tempV3_2 = new THREE.Vector3();
        this._tempMat3 = new THREE.Matrix3();
        
        this.skeleton = skeleton;
        this.config = config;
        this.bodyLocations = config.bodyLocations;
        this.handLocations = isLeftHand ? config.handLocationsL : config.handLocationsR;
        this.isLeftHand = !!isLeftHand;
        
        let boneMap = config.boneMap;
        let handName = isLeftHand ? "L" : "R";
        this.idx = {
            shoulder: boneMap[ handName + "Shoulder" ],
            arm: boneMap[ handName + "Arm" ],
            elbow: boneMap[ handName + "Elbow" ],
            wrist: boneMap[ handName + "Wrist" ]
        }
        
        // p : without offset. Raw location interpolation
        this.cur = new THREE.Vector3(); // world point
        this.src = new THREE.Vector3(); // world point
        this.trg = makeLocState();
        this.def = makeLocState();
        
        this.time = 0; // current time of transition
        this.start = 0; 
        this.attackPeak = 0;
        this.relax = 0;
        this.end = 0;
        
        this.transition = false;

        // assuming model will not be scaled at any point in the future
        this.worldArmSize = 0;
        this.skeleton.bones[ boneMap[ handName + "Arm" ] ].getWorldPosition( this._tempV3_0 );
        this.skeleton.bones[ boneMap[ handName + "Elbow" ] ].getWorldPosition( this._tempV3_1 );
        this.skeleton.bones[ boneMap[ handName + "Wrist" ] ].getWorldPosition( this._tempV3_2 );
        this.worldArmSize = this._tempV3_0.sub( this._tempV3_1 ).length() + this._tempV3_1.sub( this._tempV3_2 ).length();
        
        // set default poses
        this.reset();
    }

    reset(){
        this.transition = false;
        this.cur.set(0,0,0);
    }

    // todo
    update( dt ){
        
        this.time += dt;
        
        if ( this.time < this.start ){
            return;
        }
        
        if ( this.time < this.attackPeak ){
            let t = ( this.time - this.start ) / ( this.attackPeak - this.start );
            if ( t > 1 ){ t = 1; }
            t = (- Math.cos(Math.PI * t)) * 0.5 + 0.5;

            // overwriting newTarget ( aka this._tempV3_0 ). Add curve on the z axis (slightly better visually)
            let extraZSizeFactor = Math.min( 1, this.cur.distanceToSquared( this.src ) / (this.worldArmSize * this.worldArmSize * 0.5) );
            let extraZsize = this.worldArmSize * 0.3 * extraZSizeFactor; // depending on how far the next objective

            this._computeStateLocation(this.trg, this.cur);
            this.cur.lerp(this.src, (1-t));

            this.cur.z += 2 * extraZsize * t * (1-t); // bezier simplified     [ 0 | size | 0 ]
            return;
        }

        // reached peak. Change to fixed pipeline
        if ( this.trg.mode == E_LOCATIONBODYARM_MODE_UPDATEUNTILCONTACT ){
            this._computeStateLocation(this.trg, this.trg.fixedPosition);
            this.trg.mode = E_LOCATIONBODYARM_MODE_FIXED;
            if ( this.trg.isShift ){
                this._copyStates(this.trg, this.def);
            }            
        }

        if ( this.time < this.relax ){
            this._computeStateLocation(this.trg, this.cur);            
        }
        else if ( this.time < this.end ){
            let t = ( this.time - this.relax ) / ( this.end - this.relax );
            if ( t > 1 ){ t = 1; }
            t = (- Math.cos(Math.PI * t)) * 0.5 + 0.5;

            this._computeStateLocation(this.trg, this.cur);
            this._computeStateLocation(this.def, this._tempV3_2);
            
            // overwriting newTarget ( aka this._tempV3_0 ). Add curve on the z axis (slightly better visually)
            let extraZSizeFactor = Math.min( 1, this.cur.distanceToSquared( this._tempV3_2 ) / (this.worldArmSize * this.worldArmSize * 0.5) );
            let extraZsize = this.worldArmSize * 0.3 * extraZSizeFactor; // depending on how far the next objective
            
            this.cur.lerp(this._tempV3_2, t);
            this.cur.z += 2 * extraZsize * t * (1-t); // bezier simplified     [ 0 | size | 0 ]

        }else if( this.time >= this.end){
            this._computeStateLocation(this.def, this.cur);
            this.transition = false;
        }
    }

    /** uses tempVec3_0, tempVec3_1, tempMat3 */ 
    _computeStateLocation(state, resultPos){
        if( state.mode == E_LOCATIONBODYARM_MODE_FIXED){
            resultPos.copy(state.fixedPosition);
            return;
        }
        // set current location as the target point. We will modify it later if needed
        this._computeLocation(state.loc, state.distance, state.mode == E_LOCATIONBODYARM_MODE_NEUTRAL, resultPos );
        if ( state.sloc){
            this._computeLocation(state.sloc, state.distance, state.mode == E_LOCATIONBODYARM_MODE_NEUTRAL, this._tempV3_1);
            resultPos.add(this._tempV3_1).multiplyScalar(0.5);
        }
        // contact and displace
        if ( state.contactFinger ){
            this._computeContactOffset(state.contactFinger, this._tempV3_1);
            resultPos.add(this._tempV3_1);
        }
        resultPos.add(state.displace);
    }

    /** uses tempVec3_0 and tempMat3 */
    _computeLocation(location, normDistance, fromNeutralPose, resultPos ){
        if ( fromNeutralPose ){
            // usually these lines will only be executed once, during newGestureBML

            let boneIdx = findIndexOfBone(this.skeleton, location.parent);
            let m4 = this.skeleton.boneInverses[ 0 ].clone();
            m4.premultiply( this.skeleton.boneInverses[boneIdx] )
            m4.invert(); // from bone to root (excluding root)
            m4.premultiply(this.skeleton.bones[0].matrixWorld); // translation and rotation of real root
            resultPos.copy(location.position)
            resultPos.applyMatrix4(m4);
            return;
        }

        location.getWorldPosition( resultPos );
        
        if ( location.direction ){
            let m3 = this._tempMat3.setFromMatrix4( location.matrixWorld );
            this._tempV3_0.copy( location.direction ).applyMatrix3( m3 ).normalize(); // from bone local space to world space direction 
        }else{
            // use avatar Z axis as distance
            this._tempV3_0.copy( this.config.axes[2] );
            // from mesh space to hips local space direction
            let m3 = this._tempMat3.setFromMatrix4( this.skeleton.boneInverses[ this.config.boneMap.Hips ] );
            this._tempV3_0.applyMatrix3( m3 );
            // from hips local space to world space direction
            m3.setFromMatrix4( this.skeleton.bones[ this.config.boneMap.Hips ].matrixWorld );
            this._tempV3_0.applyMatrix3( m3 );
            this._tempV3_0.normalize();  
        }
        resultPos.addScaledVector( this._tempV3_0, this.worldArmSize * normDistance );
    }

    /**  uses tempVec3_0 and tempMat3 */
    _computeContactOffset(contact, resultDir){
        contact.updateWorldMatrix( true ); // self and parents 
        this._tempV3_0.setFromMatrixPosition( contact.matrixWorld );
        resultDir.setFromMatrixPosition( this.skeleton.bones[ this.idx.wrist ].matrixWorld );
        resultDir.sub( this._tempV3_0 );
    }


    // all second and main attributes do not get mixed until the end (jasigning)
    _newGestureLocationComposer( bml, symmetry, isSecond = false ){
        let location = isSecond ? bml.secondLocationBodyArm : bml.locationBodyArm;

        if ( typeof( location ) != "string" ){ return null; }
        location = location.toUpperCase();

        if ( location == "EAR" || location == "EARLOBE" || location == "CHEEK" || location == "EYE" || location == "EYEBROW" || location == "SHOULDER" ){
            location += this.isLeftHand ? "_LEFT" : "_RIGHT";
        }
       
        let side = isSecond ? bml.secondSide : bml.side;
        if ( stringToDirection( side, this._tempV3_0, symmetry, true ) ){ // accumulate result and do not normalize
            // 0.5 and 1.5 to avoid rounding problems
            if ( this._tempV3_0.x < -1.5 ){ location += "_SideRR"; }
            else if ( this._tempV3_0.x < -0.5 ){ location += "_SideR"; }
            else if ( this._tempV3_0.x > 1.5 ){ location += "_SideLL"; }
            else if ( this._tempV3_0.x > 0.5 ){ location += "_SideL"; }
        }

        
        location = this.bodyLocations[ location ];
        if ( !location ){ return null; }

        return location;
    }
    /**
     * bml info
     * start, attackPeak, relax, end
     * locationBodyArm: string from bodyLocations
     * secondLocationBodyArm: (optional)
     * distance: (optional) [0,1] how far from the body to locate the hand. 0 = touch, 1 = arm extended (distance == arm size). 
     * side: (optional) rr, r, l, ll. If non-existant, defaults to center
     * secondSide: (optional)
     * 
     * displace: 26 directions
     * displaceDistance: metres
     * 
     * elbowRaise: (optional) in degrees. Positive values raise the elbow.
     * 
     * Following attributes describe which part of the hand will try to reach the locationBodyArm location 
     * srcContact: (optional) source contact location in a single variable. Strings must be concatenate as srcFinger + srcLocation + srcSide (whenever each variable is needed)
     * srcFinger: (optional) 1,2,3,4,5
     * srcLocation: (optional) string from handLocations (although no forearm, elbow, upperarm are valid inputs here)
     * srcSide: (optional) ULNAR, RADIAL, PALMAR, BACK. (ulnar == thumb side, radial == pinky side. Since hands are mirrored, this system is better than left/right)
     * keepUpdatingContact: (optional) once peak is reached, the location will be updated only if this is true. Default false
     *                  i.e: set to false; contact tip of index; reach destination. Afterwards, changing index finger state will not modify the location
     *                       set to true; contact tip of index; reach destination. Afterwards, changing index finger state (handshape) will make the location change depending on where the tip of the index is  
     * shift does not use contact locations
     */
    newGestureBML( bml, symmetry = E_FLAG_SYMMETRY_NONE, lastFrameWorldOffset = null ) {
        let loc = this._newGestureLocationComposer( bml, symmetry, false );
        if ( ! loc ){
            console.warn( "Gesture: Location Arm no location found with name \"" + bml.locationBodyArm + "\"" );
            return false;
        };

        this.trg.loc = loc;
        this.trg.sloc = this._newGestureLocationComposer( bml, symmetry, true );
        this.trg.distance = isNaN( bml.distance ) ? 0 : bml.distance;
        // displacement
        if ( stringToDirection( bml.displace, this.trg.displace, symmetry, true ) ){
            let sideDist = parseFloat( bml.displaceDistance );
            sideDist = isNaN( sideDist ) ? 0 : sideDist;
            this.trg.displace.normalize().multiplyScalar(sideDist);
        }else{
            this.trg.displace.set(0,0,0);
        }

        // in case the user selects a specific finger bone as end effector. Not affected by shift
        this.trg.contactFinger = null;
        this.trg.keepUpdatingContact = false;
        let contact = EBMLC.HandConstellation.handLocationComposer( bml, this.handLocations, this.isLeftHand, true, false );
        if( contact ){
            // only hand locations allowed as contact
            if ( contact.name && !contact.name.includes( "ARM" ) && !contact.name.includes( "ELBOW" ) ){ 
                this.trg.contactFinger = contact;
                this.trg.keepUpdatingContact = !!bml.keepUpdatingContact;
            }
            // TODO: missing second attributes
        }


        if (bml.mode == "uc"){ // update until contact - updates target real location until it reaches peak. Then it hardcodes the position in world space. If shift=true, the default will pick this hardcoded value 
            this.trg.mode = E_LOCATIONBODYARM_MODE_UPDATEUNTILCONTACT;
        }
        else if (bml.mode == "nt"){ // neutral - computes the location as if the avatar was in bind pose (assuming t-a-y-pose) and hardcodes it
            this.trg.mode = E_LOCATIONBODYARM_MODE_NEUTRAL;
            this._computeStateLocation(this.trg, this.trg.fixedPosition);
        }
        else{
            // update - always update target/default real location 
            this.trg.mode = E_LOCATIONBODYARM_MODE_UPDATE;
        } 
        // else if (bml.mode == "cr"){ // current - computes the location with the current pose (on newgesturebml) and harcodes it
        //     this.trg.mode = E_LOCATIONBODYARM_MODE_UPDATE;
        //     this._computeStateLocation(this.trg, this.trg.fixedPosition);
        //     this.trg.mode = E_LOCATIONBODYARM_MODE_FIXED;
        // }

        // change arm's default pose if necesary
        if ( bml.shift ){
            copyLocState(this.trg, this.def);
        }

        // source: Copy current arm state
        if ( lastFrameWorldOffset ){
            this.src.copy( lastFrameWorldOffset );
        }else{
            this.src.copy( this.cur );
        }

        // check and set timings
        this.start = bml.start;
        this.attackPeak = bml.attackPeak;
        this.relax = bml.relax;
        this.end = bml.end;
        this.time = 0;
        this.transition = true;

        return true;
    }   
}

EBMLC.LocationBodyArm = LocationBodyArm;

export{ LocationBodyArm };


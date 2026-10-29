# (Unfinished) Version 2.0
 - WristMotion
    - It is now additive. Multiple wrist motions can coexist.
    - Added new modes (```extension```, ```flexion```, ```swing_ulnar```, ```swing_radial```, ```pronation```, ```supination```) and modified the behaviour of existing ones (```nod```, ```swing```, ```twist```). 
    - Removed "speed" attribute.
    - Added "cycles" attribute.

 - LocationBodyArm
    - Added modes of location and changed the default behaviour. When torso moves, the underlying points also move. This new version recomputes the point location and updates the target accordingly. The default behaviour can be overriden with the attribute ```mode```. 
    - Default pose (shift attribute) follows the same mode policy as target.
    - Default pose (shift attribute) now keeps srcFinger, srcLocation, srcSide information.
    - sigml parser uses the default behaviour.

/**
 * @file Picker
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 * @private
 */


import { Color, Vector3 } from "../../lib/three.es6.js";

import { calculateMeanVector3 } from "../math/vector-utils.js";
import Selection from "../selection.js";


/**
 * Picker class
 * @interface
 */
class Picker{

    /**
     * @param  {Array|TypedArray} [array] - mapping
     */
    constructor( array ){
        this.array = array;
    }

    /**
     * Get the index for the given picking id
     * @param  {Integer} pid - the picking id
     * @return {Integer} the index
     */
    getIndex( pid ){
        return this.array ? this.array[ pid ] : pid;
    }

    /**
     * Get object data
     * @abstract
     * @param  {Integer} pid - the picking id
     * @return {Object} the object data
     */
    getObject( /*pid*/ ){
        return {};
    }

    _applyTransformations( vector, instance, component ){
        if( instance ){
            vector.applyMatrix4( instance.matrix );
        }
        if( component ){
            vector.applyMatrix4( component.matrix );
        }
        return vector;
    }

    /**
     * Get object position
     * @abstract
     * @param  {Integer} pid - the picking id
     * @return {Vector3} the object position
     */
    _getPosition( /*pid*/ ){
        return new Vector3();
    }

    /**
     * Get position for the given picking id
     * @param  {Integer} pid - the picking id
     * @param  {Object} instance - the instance that should be applied
     * @param  {Component} component - the component of the picked object
     * @return {Vector3} the position
     */
    getPosition( pid, instance, component ){
        return this._applyTransformations(
            this._getPosition( pid ), instance, component
        );
    }

}


/**
 * Shape picker class
 * @interface
 */
class ShapePicker extends Picker{

    /**
     * @param  {Shape} shape - shape object
     */
    constructor( shape ){
        super();
        this.shape = shape;
    }

    get data (){ return this.shape; }

}


//


class CylinderPicker extends ShapePicker{

    get type (){ return "cylinder"; }

    getObject( pid ){
        const s = this.shape;
        return {
            shape: s,
            color: new Color().fromArray( s.cylinderColor, 3 * pid ),
            radius: s.cylinderRadius[ pid ],
            position1: new Vector3().fromArray( s.cylinderPosition1, 3 * pid ),
            position2: new Vector3().fromArray( s.cylinderPosition2, 3 * pid ),
            name: s.cylinderName[ pid ]
        };
    }

    _getPosition( pid ){
        const s = this.shape;
        const p1 = new Vector3().fromArray( s.cylinderPosition1, 3 * pid );
        const p2 = new Vector3().fromArray( s.cylinderPosition2, 3 * pid );
        return p1.add( p2 ).multiplyScalar( 0.5 );
    }

}


class ArrowPicker extends ShapePicker{

    get type (){ return "arrow"; }

    getObject( pid ){
        const s = this.shape;
        return {
            shape: s,
            position: this._getPosition( pid ),
            position1: new Vector3().fromArray( s.arrowPosition1, 3 * pid ),
            position2: new Vector3().fromArray( s.arrowPosition2, 3 * pid ),
            color: new Color().fromArray( s.arrowColor, 3 * pid ),
            radius: s.arrowRadius[ pid ],
            name: s.arrowName[ pid ]
        };
    }

    _getPosition( pid ){
        const s = this.shape;
        const p1 = new Vector3().fromArray( s.arrowPosition1, 3 * pid );
        const p2 = new Vector3().fromArray( s.arrowPosition2, 3 * pid );
        return p1.add( p2 ).multiplyScalar( 0.5 );
    }

}


class AtomPicker extends Picker{

    constructor( array, structure ){
        super( array );
        this.structure = structure;
    }

    get type (){ return "atom"; }
    get data (){ return this.structure; }

    getObject( pid ){
        return this.structure.getAtomProxy( this.getIndex( pid ) );
    }

    _getPosition( pid ){
        return new Vector3().copy( this.getObject( pid ) );
    }

}


class AxesPicker extends Picker{

    constructor( axes ){
        super();
        this.axes = axes;
    }

    get type (){ return "axes"; }
    get data (){ return this.axes; }

    getObject( /*pid*/ ){
        return {
            axes: this.axes
        };
    }

    _getPosition( /*pid*/ ){
        return this.axes.center.clone();
    }

}


class BondPicker extends Picker{

    constructor( array, structure, bondStore ){
        super( array );
        this.structure = structure;
        this.bondStore = bondStore || structure.bondStore;
    }

    get type (){ return "bond"; }
    get data (){ return this.structure; }

    getObject( pid ){
        var bp = this.structure.getBondProxy( this.getIndex( pid ) );
        bp.bondStore = this.bondStore;
        return bp;
    }

    _getPosition( pid ){
        const b = this.getObject( pid );
        return new Vector3()
            .copy( b.atom1 )
            .add( b.atom2 )
            .multiplyScalar( 0.5 );
    }

}


class ContactPicker extends BondPicker{

    get type (){ return "contact"; }

}


class ConePicker extends ShapePicker{

    get type (){ return "cone"; }

    getObject( pid ){
        const s = this.shape;
        return {
            shape: s,
            position: this._getPosition( pid ),
            position1: new Vector3().fromArray( s.conePosition1, 3 * pid ),
            position2: new Vector3().fromArray( s.conePosition2, 3 * pid ),
            color: new Color().fromArray( s.coneColor, 3 * pid ),
            radius: s.coneRadius[ pid ],
            name: s.coneName[ pid ]
        };
    }

    _getPosition( pid ){
        const s = this.shape;
        const p1 = new Vector3().fromArray( s.conePosition1, 3 * pid );
        const p2 = new Vector3().fromArray( s.conePosition2, 3 * pid );
        return p1.add( p2 ).multiplyScalar( 0.5 );
    }

}


class ClashPicker extends Picker{

    constructor( array, validation, structure ){
        super( array );
        this.validation = validation;
        this.structure = structure;
    }

    get type (){ return "clash"; }
    get data (){ return this.validation; }

    getObject( pid ){
        const val = this.validation;
        const idx = this.getIndex( pid );
        return {
            validation: val,
            index: idx,
            clash: val.clashArray[ idx ]
        };
    }

    _getAtomProxyFromSele( sele ){
        const selection = new Selection( sele );
        const idx = this.structure.getAtomIndices( selection )[ 0 ];
        return this.structure.getAtomProxy( idx );
    }

    _getPosition( pid ){
        const clash = this.getObject( pid ).clash;
        const ap1 = this._getAtomProxyFromSele( clash.sele1 );
        const ap2 = this._getAtomProxyFromSele( clash.sele2 );
        return new Vector3().copy( ap1 ).add( ap2 ).multiplyScalar( 0.5 );
    }

}


class DistancePicker extends BondPicker{

    get type (){ return "distance"; }

}


class EllipsoidPicker extends ShapePicker{

    get type (){ return "ellipsoid"; }

    getObject( pid ){
        const s = this.shape;
        return {
            shape: s,
            position: this._getPosition( pid ),
            color: new Color().fromArray( s.ellipsoidColor, 3 * pid ),
            radius: s.ellipsoidRadius[ pid ],
            majorAxis: new Vector3().fromArray( s.ellipsoidMajorAxis, 3 * pid ),
            minorAxis: new Vector3().fromArray( s.ellipsoidMinorAxis, 3 * pid ),
            name: s.ellipsoidName[ pid ]
        };
    }

    _getPosition( pid ){
        return new Vector3().fromArray( this.shape.ellipsoidPosition, 3 * pid );
    }

}


class IgnorePicker extends Picker{

    get type (){ return "ignore"; }

}


class MeshPicker extends ShapePicker{

    constructor( shape, mesh ){
        super( shape );
        this.mesh = mesh;
    }

    get type (){ return "mesh"; }

    getObject( /*pid*/ ){
        const m = this.mesh;
        return {
            shape: this.shape,
            name: m.name,
            serial: m.serial
        };
    }

    _getPosition( /*pid*/ ){
        if( !this.__position ){
            this.__position = calculateMeanVector3( this.mesh.position );
        }
        return this.__position;
    }

}


class SpherePicker extends ShapePicker{

    get type (){ return "sphere"; }

    getObject( pid ){
        const s = this.shape;
        return {
            shape: s,
            position: this._getPosition( pid ),
            color: new Color().fromArray( s.sphereColor, 3 * pid ),
            radius: s.sphereRadius[ pid ],
            name: s.sphereName[ pid ]
        };
    }

    _getPosition( pid ){
        return new Vector3().fromArray( this.shape.spherePosition, 3 * pid );
    }

}


class SurfacePicker extends Picker{

    constructor( array, surface ){
        super( array );
        this.surface = surface;
    }

    get type (){ return "surface"; }
    get data (){ return this.surface; }

    getObject( pid ){
        return {
            surface: this.surface,
            index: this.getIndex( pid )
        };
    }

    _getPosition( /*pid*/ ){
        return this.surface.center.clone();
    }

}


class UnitcellPicker extends Picker{

    constructor( unitcell, structure ){
        super();
        this.unitcell = unitcell;
        this.structure = structure;
    }

    get type (){ return "unitcell"; }
    get data (){ return this.unitcell; }

    getObject( /*pid*/ ){
        return {
            unitcell: this.unitcell,
            structure: this.structure
        };
    }

    _getPosition( /*pid*/ ){
        return this.unitcell.getCenter( this.structure );
    }

}


class UnknownPicker extends Picker{

    get type (){ return "unknown"; }

}


class VolumePicker extends Picker{

    constructor( array, volume ){
        super( array );
        this.volume = volume;
    }

    get type (){ return "volume"; }
    get data (){ return this.volume; }

    getObject( pid ){
        const vol = this.volume;
        const idx = this.getIndex( pid );
        return {
            volume: vol,
            index: idx,
            value: vol.data[ idx ]
        };
    }

    _getPosition( pid ){
        const dp = this.volume.position;
        const idx = this.getIndex( pid );
        return new Vector3(
            dp[ idx * 3 ],
            dp[ idx * 3 + 1 ],
            dp[ idx * 3 + 2 ]
        );
    }

}


class SlicePicker extends VolumePicker{

    get type (){ return "slice"; }

}


export {
    Picker,
    ShapePicker,
    ArrowPicker,
    AtomPicker,
    AxesPicker,
    BondPicker,
    ConePicker,
    ContactPicker,
    CylinderPicker,
    ClashPicker,
    DistancePicker,
    EllipsoidPicker,
    IgnorePicker,
    MeshPicker,
    SlicePicker,
    SpherePicker,
    SurfacePicker,
    UnitcellPicker,
    UnknownPicker,
    VolumePicker
};

/**
 * @file Distance Representation
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 * @private
 */


import { Color } from "../../lib/three.es6.js";

import { Browser, RepresentationRegistry } from "../globals.js";
import { defaults } from "../utils.js";
import { uniformArray, uniformArray3 } from "../math/array-utils.js";
import Bitset from "../utils/bitset.js";
import StructureRepresentation from "./structure-representation.js";
import Selection from "../selection.js";
import BondStore from "../store/bond-store.js";
import TextBuffer from "../buffer/text-buffer.js";
import CylinderBuffer from "../buffer/cylinder-buffer.js";


/**
 * Distance representation parameter object.
 * @typedef {Object} DistanceRepresentationParameters - distance representation parameters
 * @mixes RepresentationParameters
 * @mixes StructureRepresentationParameters
 *
 * @property {Float} labelSize - size of the distance label
 * @property {Color} labelColor - color of the distance label
 * @property {Boolean} labelVisible - visibility of the distance label
 * @property {Float} labelZOffset - offset in z-direction (i.e. in camera direction)
 * @property {Array[]} atomPair - list of pairs of selection strings, see {@link Selection}
 * @property {Integer} radialSegments - cylinder quality (number of segments)
 * @property {Boolean} disableImpostor - disable use of raycasted impostors for rendering
 */


/**
 * Distance representation object
 * @class
 * @extends StructureRepresentation
 * @example
 * stage.loadFile( "rcsb://1crn" ).then( function( o ){
 *     o.addRepresentation( "cartoon" );
 *     // any selection allowed, always takes the first atom a selection evaluates to
 *     var atomPair = [ [ "1.CA", "4.CA" ], [ "7.CA", "13.CA" ] ];
 *     o.addRepresentation( "distance", { atomPair: atomPair } );
 *     stage.centerView();
 * } );
 * @param {Structure} structure - the structure to be represented
 * @param {Viewer} viewer - a viewer object
 * @param {DistanceRepresentationParameters} params - distance representation parameters
 */
function DistanceRepresentation( structure, viewer, params ){

    StructureRepresentation.call( this, structure, viewer, params );

}

DistanceRepresentation.prototype = Object.assign( Object.create(

    StructureRepresentation.prototype ), {

    constructor: DistanceRepresentation,

    type: "distance",

    defaultSize: 0.15,

    parameters: Object.assign( {

        labelSize: {
            type: "number", precision: 3, max: 10.0, min: 0.001
        },
        labelColor: {
            type: "color"
        },
        labelVisible: {
            type: "boolean"
        },
        labelZOffset: {
            type: "number", precision: 1, max: 20, min: -20, buffer: "zOffset"
        },
        atomPair: {
            type: "hidden", rebuild: true
        },
        radialSegments: true,
        disableImpostor: true

    }, StructureRepresentation.prototype.parameters, {
        flatShaded: null,
        assembly: null
    } ),

    init: function( params ){

        var p = params || {};
        p.radius = defaults( p.radius, this.defaultSize );

        this.fontFamily = defaults( p.fontFamily, "sans-serif" );
        this.fontStyle = defaults( p.fontStyle, "normal" );
        this.fontWeight = defaults( p.fontWeight, "bold" );
        this.sdf = defaults( p.sdf, Browser !== "Firefox" );  // FIXME
        this.labelSize = defaults( p.labelSize, 2.0 );
        this.labelColor = defaults( p.labelColor, 0xFFFFFF );
        this.labelVisible = defaults( p.labelVisible, true );
        this.labelZOffset = defaults( p.labelZOffset, 0.5 );
        this.atomPair = defaults( p.atomPair, [] );

        StructureRepresentation.prototype.init.call( this, p );

    },

    getDistanceData: function( sview, atomPair ){

        var n = atomPair.length;
        var text = new Array( n );
        var position = new Float32Array( n * 3 );
        var sele1 = new Selection();
        var sele2 = new Selection();

        var bondStore = new BondStore();

        var ap1 = sview.getAtomProxy();
        var ap2 = sview.getAtomProxy();

        var j = 0;
        
        this.nastyCache = this.nastyCache || {};

        atomPair.forEach( function( pair, i ){

            i -= j;
            var i3 = i * 3;

            var nasty = this.nastyCache[pair[0]+"-"+pair[1]];
            if (!nasty) {
                sele1.setString( pair[ 0 ] );
                sele2.setString( pair[ 1 ] );

                nasty = {sel1: sview.getAtomIndices( sele1 ), sel2: sview.getAtomIndices( sele2 )};
                this.nastyCache[pair[0]+"-"+pair[1]] = nasty;
            }
            var atomIndices1 = nasty.sel1;
	        var atomIndices2 = nasty.sel2;

            if( atomIndices1.length && atomIndices2.length ){

                ap1.index = atomIndices1[ 0 ];
                ap2.index = atomIndices2[ 0 ];

                bondStore.addBond( ap1, ap2, 1 );

                text[ i ] = ap1.distanceTo( ap2 ).toFixed( 2 );

                position[ i3 + 0 ] = ( ap1.x + ap2.x ) / 2;
                position[ i3 + 1 ] = ( ap1.y + ap2.y ) / 2;
                position[ i3 + 2 ] = ( ap1.z + ap2.z ) / 2;

            }else{

                j += 1;

            }

        }, this );

        if( j > 0 ){
            n -= j;
            position = position.subarray( 0, n * 3 );
        }

        var bondSet = new Bitset( bondStore.count );
        bondSet.set_all( true );

        return {
            text: text,
            position: position,
            bondSet: bondSet,
            bondStore: bondStore
        };

    },

    getBondData: function( sview, what, params ){

        return sview.getBondData( this.getBondParams( what, params ) );

    },

    create: function(){

        if( this.structureView.atomCount === 0 ) return;

        var n = this.atomPair.length;
        if( n === 0 ) return;

        var distanceData = this.getDistanceData( this.structureView, this.atomPair );

        var c = new Color( this.labelColor );

        this.textBuffer = new TextBuffer(
            distanceData.position,
            uniformArray( n, this.labelSize ),
            uniformArray3( n, c.r, c.g, c.b ),
            distanceData.text,
            this.getBufferParams( {
                fontFamily: this.fontFamily,
                fontStyle: this.fontStyle,
                fontWeight: this.fontWeight,
                sdf: this.sdf,
                zOffset: this.labelZOffset,
                opacity: 1.0,
                visible: this.labelVisible
            } )
        );

        var bondParams = {
            bondSet: distanceData.bondSet,
            bondStore: distanceData.bondStore
        };

        var bondData = this.getBondData( this.structureView, undefined, bondParams );

        this.cylinderBuffer = new CylinderBuffer(
            bondData.position1,
            bondData.position2,
            bondData.color1,
            bondData.color2,
            bondData.radius,
            bondData.pickingColor1,
            bondData.pickingColor2,
            this.getBufferParams( {
                openEnded: false,
                radialSegments: this.radialSegments,
                disableImpostor: this.disableImpostor,
                dullInterior: true
            } )
        );

        this.dataList.push( {
            sview: this.structureView,
            bondSet: distanceData.bondSet,
            bondStore: distanceData.bondStore,
            position: distanceData.position,
            bufferList: [ this.textBuffer, this.cylinderBuffer ]
        } );

    },

    update: function( what ){

        if( what.position ){
            this.build();
        }else{
            StructureRepresentation.prototype.update.call( this, what );
        }

    },

    updateData: function( what, data ){

        var bondParams = {
            bondSet: data.bondSet,
            bondStore: data.bondStore
        };

        var bondData = this.getBondData( data.sview, what, bondParams );
        var cylinderData = {};
        var textData = {};
        var n = this.atomPair.length;

        if( what.labelSize ){
            textData.size = uniformArray( n, this.labelSize );
        }

        if( what.labelColor ){
            var c = new Color( this.labelColor );
            textData.color = uniformArray3( n, c.r, c.g, c.b );
        }

        if( what.color ){
            cylinderData.color = bondData.color1;
            cylinderData.color2 = bondData.color2;
        }

        if( what.radius || what.scale ){
            cylinderData.radius = bondData.radius;
        }

        this.textBuffer.setAttributes( textData );
        this.cylinderBuffer.setAttributes( cylinderData );

    },

    setVisibility: function( value, noRenderRequest ){

        StructureRepresentation.prototype.setVisibility.call(
            this, value, true
        );

        if( this.textBuffer ){
            this.textBuffer.setVisibility(
                this.labelVisible && this.visible
            );
        }

        if( !noRenderRequest ) this.viewer.requestRender();

        return this;

    },

    setParameters: function( params ){

        var rebuild = false;
        var what = {};

        if( params && params.labelSize ){
            what.labelSize = true;
        }

        if( params && params.labelColor ){
            what.labelColor = true;
        }

        StructureRepresentation.prototype.setParameters.call(
            this, params, what, rebuild
        );

        if( params && params.labelVisible !== undefined ){
            this.setVisibility( this.visible );
        }

        return this;

    }

} );


RepresentationRegistry.add( "distance", DistanceRepresentation );


export default DistanceRepresentation;

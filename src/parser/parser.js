/**
 * @file Parser
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 * @private
 */


import { Debug, Log } from "../globals.js";
import { defaults } from "../utils.js";


function Parser( streamer, params ){

    var p = params || {};

    this.streamer = streamer;

    this.name = defaults( p.name, "" );
    this.path = defaults( p.path, "" );

}

Parser.prototype = {

    constructor: Parser,
    type: "",

    __objName: "",

    parse: function(){

        return this.streamer.read().then( () => {

            this._beforeParse();
            this._parse();
            this._afterParse();
            return this[ this.__objName ];

        } );

    },

    _parse: function(){},

    _beforeParse: function(){},

    _afterParse: function(){

        if( Debug ) Log.log( this[ this.__objName ] );

    }

};


export default Parser;

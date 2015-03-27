/**
 * @file Stage
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */


//////////
// Stage

NGL.Stage = function( eid ){

    var SIGNALS = signals;

    this.signals = {

        themeChanged: new SIGNALS.Signal(),

        componentAdded: new SIGNALS.Signal(),
        componentRemoved: new SIGNALS.Signal(),

        atomPicked: new SIGNALS.Signal(),

        requestTheme: new SIGNALS.Signal(),

        windowResize: new SIGNALS.Signal()

    };

    this.compList = [];

    this.preferences =  new NGL.Preferences( this );

    this.viewer = new NGL.Viewer( eid );

    this.preferences.setTheme();

    this.initFileDragDrop();

    this.viewer.animate();

    this.pickingControls = new NGL.PickingControls( this.viewer, this );

}

NGL.Stage.prototype = {

    constructor: NGL.Stage,

    defaultFileRepresentation: function( object ){

        if( object instanceof NGL.StructureComponent ){

            if( object.structure.atomCount > 100000 ){

                object.addRepresentation( "line" );
                object.centerView( undefined, true );

            }else{

                object.addRepresentation( "cartoon", { sele: "*" } );
                object.addRepresentation( "licorice", { sele: "hetero" } );
                object.centerView( undefined, true );

            }

            // add frames as trajectory
            if( object.structure.frames ) object.addTrajectory();

        }else if( object instanceof NGL.SurfaceComponent ){

            object.addRepresentation( "surface" );
            object.centerView();

        }else if( object instanceof NGL.ScriptComponent ){

            object.run();

        }

    },

    initFileDragDrop: function(){

        this.viewer.container.addEventListener( 'dragover', function( e ){

            e.stopPropagation();
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';

        }, false );

        this.viewer.container.addEventListener( 'drop', function( e ){

            e.stopPropagation();
            e.preventDefault();

            var fileList = e.dataTransfer.files;
            var n = fileList.length;

            for( var i=0; i<n; ++i ){

                this.loadFile( fileList[ i ] );

            }

        }.bind( this ), false );

    },

    loadFile: function( path, onLoad, params, onError, loadParams ){

        var component;
        var scope = this;

        function load( object ){

            // check for placeholder component
            if( component ){

                scope.removeComponent( component );

            }

            if( object instanceof NGL.Structure ){

                component = new NGL.StructureComponent( scope, object, params );

            }else if( object instanceof NGL.Surface || object instanceof NGL.Volume ){

                component = new NGL.SurfaceComponent( scope, object, params );

            }else if( object instanceof NGL.Script ){

                component = new NGL.ScriptComponent( scope, object, params );

            }else{

                NGL.warn( "NGL.Stage.loadFile: object type unknown", object );
                return;

            }

            scope.addComponent( component );

            if( typeof onLoad === "function" ){

                onLoad( component );

            }else{

                scope.defaultFileRepresentation( component );

            }

        }

        var _e;

        function error( e ){

            _e = e;

            if( component ) component.setStatus( e );

            if( typeof onError === "function" ) onError( e );

        }

        NGL.autoLoad( path, load, undefined, error, loadParams );

        // ensure that component isn't ready yet
        if( !component ){

            component = new NGL.Component( this, params );
            var path2 = ( path instanceof File ) ? path.name : path;
            component.name = path2.replace( /^.*[\\\/]/, '' );

            this.addComponent( component );

        }

        // set error status when already known
        if( _e ) component.setStatus( _e );

    },

    addComponent: function( component ){

        if( !component ){

            NGL.warn( "NGL.Stage.addComponent: no component given" );
            return;

        }

        this.compList.push( component );

        this.signals.componentAdded.dispatch( component );

    },

    removeComponent: function( component ){

        var idx = this.compList.indexOf( component );

        if( idx !== -1 ){

            this.compList.splice( idx, 1 );

        }

        component.dispose();

        this.signals.componentRemoved.dispatch( component );

    },

    removeAllComponents: function( type ){

        this.compList.slice().forEach( function( o, i ){

            if( !type || o instanceof type ){

                this.removeComponent( o );

            }

        }, this );

    },

    centerView: function(){

        this.viewer.centerView( undefined, true );

    },

    exportImage: function( factor, antialias, transparent, trim, onProgress ){

        var reprParamsList = [];

        this.eachRepresentation( function( repr ){

            if( repr.visible && repr.parent.visible ){

                var r = repr.repr;

                var op = {
                    subdiv: r.subdiv,
                    radialSegments: r.radialSegments,
                    sphereDetail: r.sphereDetail,
                    radiusSegments: r.radiusSegments
                }

                reprParamsList.push( {
                    repr: repr,
                    params: op
                } );

                var p = {};

                if( op.subdiv !== undefined ){
                    p.subdiv = Math.max( 12, op.subdiv );
                }

                if( op.radialSegments !== undefined ){
                    p.radialSegments = Math.max( 20, op.radialSegments );
                }

                if( op.sphereDetail !== undefined ){
                    p.sphereDetail = Math.max( 2, op.sphereDetail );
                }

                if( op.radiusSegments !== undefined ){
                    p.radiusSegments = Math.max( 20, op.radiusSegments );
                }

                repr.setParameters( p );

            }

        }, NGL.StructureComponent );

        this.viewer.screenshot( {

            factor: factor,
            type: "image/png",
            quality: 1.0,
            antialias: antialias,
            transparent: transparent,
            trim: trim,

            onProgress: function( i, n, finished ){

                if( typeof onProgress === "function" ){

                    onProgress( i, n, finished );

                }

                if( finished ){

                    reprParamsList.forEach( function( d ){

                        d.repr.setParameters( d.params );

                    } );

                }

            }

        } );

    },

    setTheme: function( value ){

        var viewerBackground;

        if( value === "light" ){
            viewerBackground = "white";
        }else{
            viewerBackground = "black";
        }

        this.signals.requestTheme.dispatch( value );
        this.viewer.setBackground( viewerBackground );

    },

    eachComponent: function( callback, type ){

        this.compList.forEach( function( o, i ){

            if( !type || o instanceof type ){

                callback( o, i );

            }

        } );

    },

    eachRepresentation: function( callback, componentType ){

        this.eachComponent( function( o ){

            o.reprList.forEach( function( repr ){

                callback( repr, o );

            } );

        }, componentType );

    }

}


////////////
// Picking

NGL.PickingControls = function( viewer, stage ){

    var v3 = new THREE.Vector3();

    var mouse = {

        position: new THREE.Vector2(),
        down: new THREE.Vector2(),
        moving: false,
        distance: function(){
            return mouse.position.distanceTo( mouse.down );
        }

    };

    viewer.renderer.domElement.addEventListener( 'mousemove', function( e ){

        e.preventDefault();
        // e.stopPropagation();

        mouse.moving = true;
        mouse.position.x = e.layerX;
        mouse.position.y = e.layerY;

    } );

    viewer.renderer.domElement.addEventListener( 'mousedown', function( e ){

        e.preventDefault();
        // e.stopPropagation();

        mouse.moving = false;
        mouse.down.x = e.layerX;
        mouse.down.y = e.layerY;

    } );

    viewer.renderer.domElement.addEventListener( 'mouseup', function( e ){

        e.preventDefault();
        // e.stopPropagation();

        if( mouse.distance() > 3 || e.which === NGL.RightMouseButton ) return;

        var box = viewer.renderer.domElement.getBoundingClientRect();

        var offsetX = e.clientX - box.left;
        var offsetY = e.clientY - box.top;

        var pickingData = viewer.pick(
            offsetX,
            box.height - offsetY
        );
        var id = pickingData.id;
        var instance = pickingData.instance;

        // TODO early exit, binary search
        var pickedAtom = undefined;
        stage.eachComponent( function( o ){

            o.structure.eachAtom( function( a ){

                if( a.globalindex === ( id - 1 ) ){
                    pickedAtom = a;
                }

            } );

        }, NGL.StructureComponent );

        if( pickedAtom && e.which === NGL.MiddleMouseButton ){

            v3.copy( pickedAtom );

            if( instance ){

                // var structure = pickedAtom.residue.chain.model.structure;
                // var biomol = structure.biomolDict[ instance.assembly ];
                // var matrix = biomol.matrixDict[ instance.name ];

                v3.applyProjection( instance.matrix );

            }

            viewer.centerView( v3 );

        }

        stage.signals.atomPicked.dispatch( pickedAtom );

    } );

};


////////////////
// Preferences

NGL.Preferences = function( stage, id ){

    this.id = id || "ngl-stage";

    this.stage = stage;

    this.storage = {

        impostor: true,
        quality: "medium",
        theme: "dark",
        overview: true

    };


    try{

        if ( window.localStorage[ this.id ] === undefined ) {

            window.localStorage[ this.id ] = JSON.stringify( this.storage );

        } else {

            var data = JSON.parse( window.localStorage[ this.id ] );

            for ( var key in data ) {

                this.storage[ key ] = data[ key ];

            }

        }

    }catch( e ){

        NGL.error( "localStorage not accessible/available" );

    }

};

NGL.Preferences.prototype = {

    constructor: NGL.Preferences,

    setImpostor: function( value ) {

        if( value !== undefined ){
            this.setKey( "impostor", value );
        }else{
            value = this.getKey( "impostor" );
        }

        var types = [
            "spacefill", "ball+stick", "licorice", "hyperball",
            "backbone", "rocket", "crossing", "contact",
            "dot"
        ];

        this.stage.eachRepresentation( function( repr ){

            if( repr instanceof NGL.ScriptComponent ) return;

            if( types.indexOf( repr.getType() ) === -1 ){
                return;
            }

            var p = repr.getParameters();
            p.disableImpostor = !value;
            repr.rebuild( p );

        } );

    },

    setQuality: function( value ) {

        if( value !== undefined ){
            this.setKey( "quality", value );
        }else{
            value = this.getKey( "quality" );
        }

        var types = [
            "tube", "cartoon", "ribbon", "trace", "rope"
        ];

        var impostorTypes = [
            "spacefill", "ball+stick", "licorice", "hyperball",
            "backbone", "rocket", "crossing", "contact",
            "dot"
        ];

        this.stage.eachRepresentation( function( repr ){

            if( repr instanceof NGL.ScriptComponent ) return;

            var p = repr.getParameters();

            if( types.indexOf( repr.getType() ) === -1 ){

                if( impostorTypes.indexOf( repr.getType() ) === -1 ){
                    return;
                }

                if( NGL.extensionFragDepth && !p.disableImpostor ){
                    repr.repr.quality = value;
                    return;
                }

            }

            p.quality = value;
            repr.rebuild( p );

        } );

    },

    setTheme: function( value ) {

        if( value !== undefined ){
            this.setKey( "theme", value );
        }else{
            value = this.getKey( "theme" );
        }

        this.stage.setTheme( value );

    },

    getKey: function( key ){

        return this.storage[ key ];

    },

    setKey: function( key, value ){

        this.storage[ key ] = value;

        try{

            window.localStorage[ this.id ] = JSON.stringify( this.storage );

        }catch( e ){

            // Webkit === 22 / Firefox === 1014

            if( e.code === 22 || e.code === 1014 ){

                NGL.error( "localStorage full" );

            }else{

                NGL.error( "localStorage not accessible/available" );

            }

        }

    },

    clear: function(){

        try{

            delete window.localStorage[ this.id ];

        }catch( e ){

            NGL.error( "localStorage not accessible/available" );

        }

    }

};


//////////////
// Component

NGL.Component = function( stage, params ){

    params = params || {};

    if( params.name !== undefined ){
        this.name = params.name;
    }
    this.id = params.id;
    this.tags = params.tags || [];
    this.visible = params.visible !== undefined ? params.visible : true;

    this.signals = NGL.makeObjectSignals( this );

    this.stage = stage;
    this.viewer = stage.viewer;

    this.reprList = [];

}

NGL.Component.prototype = {

    constructor: NGL.Component,

    type: "component",

    signals: {

        representationAdded: null,
        representationRemoved: null,
        visibilityChanged: null,
        requestGuiVisibility: null,

        statusChanged: null,
        disposed: null,

    },

    addRepresentation: function( repr ){

        this.reprList.push( repr );

        this.signals.representationAdded.dispatch( repr );

        return this;

    },

    removeRepresentation: function( repr ){

        var idx = this.reprList.indexOf( repr );

        if( idx !== -1 ){

            this.reprList.splice( idx, 1 );

        }

        this.signals.representationRemoved.dispatch( repr );

    },

    updateRepresentations: function( what ){

        this.reprList.forEach( function( repr ){

            repr.update( what );

        } );

        this.stage.viewer.requestRender();

    },

    dispose: function(){

        // copy via .slice because side effects may change reprList
        this.reprList.slice().forEach( function( repr ){

            repr.dispose();

        } );

        delete this.reprList;

        this.signals.disposed.dispatch();

    },

    setVisibility: function( value ){

        this.visible = value;

        this.eachRepresentation( function( repr ){

            repr.updateVisibility();

        } );

        this.signals.visibilityChanged.dispatch( value );

        return this;

    },

    setStatus: function( value ){

        this.status = value;
        this.signals.statusChanged.dispatch( value );

        return this;

    },

    getCenter: function(){

        // NGL.warn( "not implemented" )

    },

    requestGuiVisibility: function( value ){

        this.signals.requestGuiVisibility.dispatch( value );

        return this;

    },

    eachRepresentation: function( callback ){

        this.reprList.forEach( callback );

    }

};

NGL.ObjectMetadata.prototype.apply( NGL.Component.prototype );


NGL.StructureComponent = function( stage, structure, params ){

    params = params || {};

    this.__structure = structure;
    this.structure = structure;
    this.name = structure.name;  // may get overwritten by params.name

    NGL.Component.call( this, stage, params );

    this.trajList = [];
    this.initSelection( params.sele );

};

NGL.StructureComponent.prototype = NGL.createObject(

    NGL.Component.prototype, {

    constructor: NGL.StructureComponent,

    type: "structure",

    signals: Object.assign( {

        "trajectoryAdded": null,
        "trajectoryRemoved": null

    }, NGL.Component.prototype.signals ),

    initSelection: function( string ){

        this.selection = new NGL.Selection( string );

        this.selection.signals.stringChanged.add( function( string ){

            this.applySelection();

            this.rebuildRepresentations( true );
            this.rebuildTrajectories();

        }, this );

        this.applySelection();

    },

    applySelection: function(){

        if( this.selection.string ){

            this.structure = new NGL.StructureSubset(
                this.__structure, this.selection.string
            );

        }else{

            this.structure = this.__structure;

        }

    },

    setSelection: function( string ){

        this.selection.setString( string );

        return this;

    },

    rebuildRepresentations: function( setStructure ){

        this.reprList.forEach( function( repr ){

            if( setStructure ){
                repr.setStructure( this.structure );
            }

            repr.rebuild( repr.getParameters() );

        }, this );

    },

    rebuildTrajectories: function(){

        this.trajList.slice( 0 ).forEach( function( trajComp ){

            trajComp.trajectory.setStructure( this.structure );

        }, this );

    },

    addRepresentation: function( type, params, returnRepr ){

        var pref = this.stage.preferences;
        params = params || {};
        params.quality = params.quality || pref.getKey( "quality" );
        params.disableImpostor = params.disableImpostor !== undefined ? params.disableImpostor : !pref.getKey( "impostor" );

        var repr = NGL.makeRepresentation(
            type, this.structure, this.viewer, params
        );

        var reprComp = new NGL.RepresentationComponent(
            this.stage, repr, params, this
        );

        NGL.Component.prototype.addRepresentation.call( this, reprComp );

        return returnRepr ? reprComp : this;

    },

    addTrajectory: function( trajPath, sele, i ){

        var params = { "i": i };

        var traj = NGL.makeTrajectory(
            trajPath, this.structure, sele
        );

        traj.signals.frameChanged.add( function( value ){

            this.updateRepresentations( { "position": true } );

        }, this );

        var trajComp = new NGL.TrajectoryComponent(
            this.stage, traj, params, this
        );

        this.trajList.push( trajComp );

        this.signals.trajectoryAdded.dispatch( trajComp );

        return trajComp;

    },

    removeTrajectory: function( traj ){

        var idx = this.trajList.indexOf( traj );

        if( idx !== -1 ){

            this.trajList.splice( idx, 1 );

        }

        traj.dispose();

        this.signals.trajectoryRemoved.dispatch( traj );

    },

    dispose: function(){

        // copy via .slice because side effects may change trajList
        this.trajList.slice().forEach( function( traj ){

            traj.dispose();

        } );

        this.trajList = [];

        this.structure.dispose();
        this.__structure.dispose();

        NGL.Component.prototype.dispose.call( this );

    },

    centerView: function( sele, zoom ){

        var center;

        if( sele ){

            var selection = new NGL.Selection( sele );

            center = this.structure.atomCenter( selection );

            if( zoom ){
                var bb = this.structure.getBoundingBox( selection );
                zoom = bb.size().length();
            }

        }else{

            center = this.structure.center;

            if( zoom ){
                zoom = this.structure.boundingBox.size().length();
            }

        }

        this.viewer.centerView( center, zoom );

        return this;

    },

    getCenter: function(){

        return this.structure.center;

    },

    superpose: function( component, align, sele1, sele2, xsele1, xsele2 ){

        NGL.superpose(
            this.structure, component.structure,
            align, sele1, sele2, xsele1, xsele2
        );


        // FIXME there should be a better way
        if( this.structure !== this.__structure ){

            NGL.superpose(
                this.__structure, component.structure,
                align, sele1, sele2, xsele1, xsele2
            );

        }

        this.updateRepresentations( { "position": true } );

        return this;

    },

    setVisibility: function( value ){

        NGL.Component.prototype.setVisibility.call( this, value );

        this.trajList.forEach( function( traj ){

            traj.setVisibility( value );

        } );

        return this;

    },

} );


NGL.SurfaceComponent = function( stage, surface, params ){

    this.surface = surface;
    this.name = surface.name;

    NGL.Component.call( this, stage, params );

};

NGL.SurfaceComponent.prototype = NGL.createObject(

    NGL.Component.prototype, {

    constructor: NGL.SurfaceComponent,

    type: "surface",

    addRepresentation: function( type, params ){

        var pref = this.stage.preferences;
        params = params || {};
        params.quality = params.quality || pref.getKey( "quality" );
        params.disableImpostor = params.disableImpostor !== undefined ? params.disableImpostor : !pref.getKey( "impostor" );

        var repr = NGL.makeRepresentation(
            type, this.surface, this.viewer, params
        );

        var reprComp = new NGL.RepresentationComponent(
            this.stage, repr, params, this
        );

        return NGL.Component.prototype.addRepresentation.call( this, reprComp );

    },

    centerView: function(){

        this.viewer.centerView();

    },

} );


NGL.TrajectoryComponent = function( stage, trajectory, params, parent ){

    params = params || {}

    this.trajectory = trajectory;
    this.name = trajectory.name;
    this.parent = parent;

    this.status = "loaded";

    NGL.Component.call( this, stage, params );

    // signals

    trajectory.signals.frameChanged.add( function( i ){

        this.signals.frameChanged.dispatch( i );

    }, this );

    trajectory.signals.playerChanged.add( function( player ){

        this.signals.playerChanged.dispatch( player );

    }, this );

    trajectory.signals.gotNumframes.add( function( n ){

        this.signals.gotNumframes.dispatch( n );

    }, this );

    //

    if( params.i !== undefined ){

        this.setFrame( params.i );

    }

};

NGL.TrajectoryComponent.prototype = NGL.createObject(

    NGL.Component.prototype, {

    constructor: NGL.TrajectoryComponent,

    type: "trajectory",

    signals: Object.assign( {

        "frameChanged": null,
        "playerChanged": null,
        "gotNumframes": null,
        "parametersChanged": null

    }, NGL.Component.prototype.signals ),

    addRepresentation: function( type, params ){

        params = params || {};

        var repr = NGL.makeRepresentation(
            type, this.trajectory, this.viewer, params
        );

        var reprComp = new NGL.RepresentationComponent(
            this.stage, repr, {}, this
        );

        return NGL.Component.prototype.addRepresentation.call(
            this, reprComp
        );

    },

    setFrame: function( i ){

        this.trajectory.setFrame( i );

    },

    setParameters: function( params ){

        this.trajectory.setParameters( params );
        this.signals.parametersChanged.dispatch( params );

        return this;

    },

    dispose: function(){

        this.trajectory.dispose();

        NGL.Component.prototype.dispose.call( this );

    },

    getCenter: function(){}

} );


NGL.ScriptComponent = function( stage, script, params ){

    this.script = script;
    this.name = script.name;

    this.status = "loaded";

    NGL.Component.call( this, stage, params );

    this.script.signals.nameChanged.add( function( value ){

        this.setName( value );

    }, this );

};

NGL.ScriptComponent.prototype = NGL.createObject(

    NGL.Component.prototype, {

    constructor: NGL.ScriptComponent,

    type: "script",

    addRepresentation: function( type ){},

    removeRepresentation: function( repr ){},

    run: function(){

        var scope = this;

        this.setStatus( "running" );

        this.script.call( this.stage, function(){

            scope.setStatus( "finished" );

        } );

        this.setStatus( "called" );

    },

    dispose: function(){

        this.signals.disposed.dispatch();

    },

    setVisibility: function( value ){},

    getCenter: function(){}

} );


NGL.RepresentationComponent = function( stage, repr, params, parent ){

    this.name = repr.type;
    this.parent = parent;

    NGL.Component.call( this, stage, params );

    this.setRepresentation( repr );

};

NGL.RepresentationComponent.prototype = NGL.createObject(

    NGL.Component.prototype, {

    constructor: NGL.RepresentationComponent,

    type: "representation",

    signals: Object.assign( {

        "visibilityChanged": null,
        "colorChanged": null,
        "parametersChanged": null,

    }, NGL.Component.prototype.signals ),

    getType: function(){

        return this.repr.type;

    },

    setRepresentation: function( repr ){

        if( this.repr ){
            this.repr.dispose();
        }

        this.repr = repr;
        this.name = repr.type;

        this.updateVisibility();

    },

    addRepresentation: function( type ){},

    removeRepresentation: function( repr ){},

    dispose: function(){

        if( this.parent ){

            this.parent.removeRepresentation( this );

        }

        this.repr.dispose();

        this.signals.disposed.dispatch();

    },

    setVisibility: function( value ){

        this.visible = value;
        this.updateVisibility();
        this.signals.visibilityChanged.dispatch( this.visible );

        return this;

    },

    updateVisibility: function(){

        if( this.parent ){

            this.repr.setVisibility( this.parent.visible && this.visible );

        }else{

            this.repr.setVisibility( this.visible );

        }

    },

    update: function( what ){

        this.repr.update( what );

        return this;

    },

    rebuild: function( params ){

        this.repr.rebuild( params );

        return this;

    },

    setStructure: function( structure ){

        this.repr.setStructure( structure );

        return this;

    },

    setSelection: function( string ){

        this.repr.setSelection( string );

        return this;

    },

    setParameters: function( params ){

        this.repr.setParameters( params );
        this.signals.parametersChanged.dispatch( params );

        return this;

    },

    getParameters: function(){

        return this.repr.getParameters();

    },

    setColor: function( value ){

        this.repr.setColor( value );
        this.signals.colorChanged.dispatch( this.repr.color );

        return this;

    },

    getCenter: function(){}

} );

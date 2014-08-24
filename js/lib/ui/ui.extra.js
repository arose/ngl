/**
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */


// Overlay Panel

UI.OverlayPanel = function(){

    UI.Panel.call( this );

    this.dom.className = 'Panel OverlayPanel';

    return this;

};

UI.OverlayPanel.prototype = Object.create( UI.Panel.prototype );

UI.OverlayPanel.prototype.attach = function( node ){

    node = node || document.body;

    node.appendChild( this.dom );

    return this;

};


// Icon (requires font awesome)

UI.Icon = function( value ){

    UI.Panel.call( this );

    var dom = document.createElement( 'span' );
    dom.className = 'Icon fa';

    this.dom = dom;

    if( value ) this.addClass.apply( this, arguments );

    return this;

};

UI.Icon.prototype = Object.create( UI.Panel.prototype );

UI.Icon.prototype.hasClass = function( value ){

    return this.dom.classList.contains( "fa-" + value );

}

UI.Icon.prototype.addClass = function( value ){

    for ( var i = 0; i < arguments.length; i ++ ) {

        this.dom.classList.add( 'fa-' + arguments[ i ] );

    }

    return this;

}

UI.Icon.prototype.setClass = function( value ){

    this.dom.className = 'Icon fa';

    for ( var i = 0; i < arguments.length; i ++ ) {
        
        this.dom.classList.add( 'fa-' + arguments[ i ] );

    }

    return this;

}

UI.Icon.prototype.removeClass = function( value ){

    for ( var i = 0; i < arguments.length; i ++ ) {

        this.dom.classList.remove( "fa-" + arguments[ i ] );

    }

    return this;

}

UI.Icon.prototype.switchClass = function( newValue, oldValue ){

    this.removeClass( oldValue, newValue );
    this.addClass( newValue );

    return this;

}


// Toggle Icon

UI.ToggleIcon = function( value, classTrue, classFalse ){

    UI.Icon.call( this, value ? classTrue : classFalse );

    this.value = value;
    this.classTrue = classTrue;
    this.classFalse = classFalse;

    return this;

};

UI.ToggleIcon.prototype = Object.create( UI.Icon.prototype );

UI.ToggleIcon.prototype.setValue = function( value ){

    this.value = value;

    if( value ){
        this.switchClass( this.classTrue, this.classFalse );
    }else{
        this.switchClass( this.classFalse, this.classTrue );
    }

    return this;
}

UI.ToggleIcon.prototype.getValue = function(){
    
    return this.value;

}


// Range

UI.Range = function( min, max, value, step ) {

    UI.Element.call( this );

    var scope = this;

    var dom = document.createElement( 'input' );
    dom.className = 'Range';
    dom.type = 'range';

    dom.min = min;
    dom.max = max;
    dom.value = value;
    dom.step = step;

    this.dom = dom;
    this.dom.textContent = value;

    return this;

};

UI.Range.prototype = Object.create( UI.Element.prototype );

UI.Range.prototype.getValue = function(){

    return this.dom.value;

};

UI.Range.prototype.setRange = function( min, max ){

    this.dom.min = min;
    this.dom.max = max;

    return this;

};

UI.Range.prototype.setValue = function( value ){

    this.dom.value = value;

    return this;

};

UI.Range.prototype.setStep = function( value ){

    this.dom.step = value;

    return this;

};


// AdaptiveTextArea

UI.AdaptiveTextArea = function () {

    // http://www.brianchu.com/blog/2013/11/02/creating-an-auto-growing-text-input/

    UI.Element.call( this );

    var scope = this;

    var container = document.createElement( 'div' );
    container.className = 'AdaptiveTextAreaContainer';

    var textarea = document.createElement( 'textarea' );
    textarea.className = 'AdaptiveTextArea';

    var size = document.createElement( 'div' );
    size.className = 'AdaptiveTextAreaSize';

    container.appendChild( textarea );
    container.appendChild( size );

    textarea.addEventListener( 'input', function ( event ) {

        size.innerHTML = textarea.value + '\n';

    }, false );

    this.textarea = textarea;
    this.size = size;
    this.dom = container;

    return this;

};

UI.AdaptiveTextArea.prototype = Object.create( UI.Element.prototype );

UI.AdaptiveTextArea.prototype.getValue = function () {

    return this.textarea.value;

};

UI.AdaptiveTextArea.prototype.setValue = function ( value ) {

    this.textarea.value = value;
    this.size.innerHTML = value + '\n';

    return this;

};

UI.AdaptiveTextArea.prototype.setSpellcheck = function ( value ) {

    this.textarea.spellcheck = value;

    return this;

};

UI.AdaptiveTextArea.prototype.setBackgroundColor = function ( value ) {

    this.textarea.style.backgroundColor = value;

    return this;

};


// Virtual List (requires Virtual DOM list)

UI.VirtualList = function( items ){

    UI.Element.call( this );

    var dom = document.createElement( 'div' );
    dom.className = 'VirtualList';
    // dom.style.cursor = 'default';
    // dom.style.display = 'inline-block';
    // dom.style.verticalAlign = 'middle';

    this.dom = dom;

    this._items = items;

    this.list = new VirtualList({
        w: 280,
        h: 300,
        itemHeight: 31,
        totalRows: items.length,
        generatorFn: function( index ) {

            var panel = new UI.Panel();
            var text = new UI.Text()
                .setColor( "orange" )
                .setMarginLeft( "10px" )
                .setValue( "ITEM " + items[ index ] );

            panel.add( text );

            return panel.dom;

        }
    });

    console.log( this.dom );
    console.log( this.list );

    this.dom.appendChild( this.list.container );

    return this;

};


// Popup Menu

UI.PopupMenu = function( iconClass ){

    UI.Panel.call( this );

    var entryLabelWidth = "100px";

    var icon = new UI.Icon( iconClass || "bars" );

    var panel = new UI.OverlayPanel()
        .setDisplay( "none" )
        .attach( this.dom );
    
    panel.add(
        new UI.Icon( "times" )
            .setFloat( "right" )
            .onClick( function(){

                panel.setDisplay( "none" );

            } )
    );

    icon.setTitle( "menu" );

    icon.onClick( function( e ){

        if( panel.getDisplay() === "block" ){

            panel.setDisplay( "none" );
            return;

        }

        var box = icon.getBox();

        panel
            .setRight( ( window.innerWidth - box.left + 10 ) + "px" )
            .setTop( ( box.top - 32 ) + "px" )
            .setDisplay( "block" );

    } );

    this.add( icon );

    this.setClass( "" )
        .setDisplay( "inline" );

    this.icon = icon;
    this.panel = panel;
    this.entryLabelWidth = entryLabelWidth;

    return this;

};

UI.PopupMenu.prototype = Object.create( UI.Panel.prototype );

UI.PopupMenu.prototype.addEntry = function( label, entry ){

    this.panel
        .add( new UI.Text( label ).setWidth( this.entryLabelWidth ) )
        .add( entry )
        .add( new UI.Break() );
    
    return this;

}

UI.PopupMenu.prototype.setEntryLabelWidth = function( value ){

    this.entryLabelWidth = value;

    return this;

}

UI.PopupMenu.prototype.setMenuDisplay = function( value ){

    this.panel.setDisplay( value );
    
    return this;

}


// Collapsible Icon Panel

UI.CollapsibleIconPanel = function( iconClass1, iconClass2 ){

    UI.Panel.call( this );

    this.dom.className = 'Panel CollapsiblePanel';

    if( iconClass1 === undefined ){

        // iconClass1 = iconClass1 || "plus-square";
        // iconClass2 = iconClass2 || "minus-square";

        iconClass1 = iconClass1 || "chevron-right";
        iconClass2 = iconClass2 || "chevron-down";

    }

    this.button = new UI.Icon( iconClass1 )
        .setWidth( "12px" ).setMarginRight( "6px" );
    this.addStatic( this.button );

    var scope = this;
    this.button.dom.addEventListener( 'click', function ( event ) {

        scope.toggle();

    }, false );

    this.content = document.createElement( 'div' );
    this.content.className = 'CollapsibleContent';
    this.dom.appendChild( this.content );

    this.isCollapsed = false;

    this.iconClass1 = iconClass1;
    this.iconClass2 = iconClass2;

    return this;

};

UI.CollapsibleIconPanel.prototype = Object.create( UI.CollapsiblePanel.prototype );

UI.CollapsibleIconPanel.prototype.setCollapsed = function( setCollapsed ) {

    if ( setCollapsed ) {

        this.dom.classList.add('collapsed');

        if( this.iconClass2 ){
        
            this.button.switchClass( this.iconClass2, this.iconClass1 );

        }else{

            this.button.addClass( "rotate-90" );

        }

    } else {

        this.dom.classList.remove('collapsed');
        
        if( this.iconClass2 ){
            
            this.button.switchClass( this.iconClass1, this.iconClass2 );

        }else{

            this.button.removeClass( "rotate-90" );

        }

    }

    this.isCollapsed = setCollapsed;

};


// Color picker (requires FlexiColorPicker)
// https://github.com/DavidDurman/FlexiColorPicker

UI.ColorPicker = function(){

    var scope = this;

    UI.Panel.call( this );

    // slider

    this.slideWrapper = new UI.Panel()
        .setClass( "slide-wrapper" );

    this.sliderIndicator = new UI.Panel()
        .setClass( "slide-indicator" );

    this.slider = new UI.Panel()
        .setClass( "slide" )
        .setWidth( "25px" )
        .setHeight( "80px" );

    this.slideWrapper.add(
        this.slider,
        this.sliderIndicator
    );

    // picker

    this.pickerWrapper = new UI.Panel()
        .setClass( "picker-wrapper" );

    this.pickerIndicator = new UI.Panel()
        .setClass( "picker-indicator" );

    this.picker = new UI.Panel()
        .setClass( "picker" )
        .setWidth( "130px" )
        .setHeight( "80px" );

    this.pickerWrapper.add(
        this.picker,
        this.pickerIndicator
    );

    // event

    var changeEvent = document.createEvent('Event');
    changeEvent.initEvent('change', true, true);

    // finalize

    this.add(
        this.pickerWrapper,
        this.slideWrapper
    );

    ColorPicker.fixIndicators(

        this.sliderIndicator.dom,
        this.pickerIndicator.dom

    );

    this.colorPicker = ColorPicker(

        this.slider.dom,
        this.picker.dom,

        function( hex, hsv, rgb, pickerCoordinate, sliderCoordinate ){

            ColorPicker.positionIndicators(
                scope.sliderIndicator.dom, scope.pickerIndicator.dom,
                sliderCoordinate, pickerCoordinate
            );

            scope.hex = hex;
            scope.hsv = hsv;
            scope.rgb = rgb;

            if( !scope._settingValue ){

                scope.dom.dispatchEvent( changeEvent, hex, hsv, rgb );

            }

        }

    );

    return this;

}

UI.ColorPicker.prototype = Object.create( UI.Panel.prototype );

UI.ColorPicker.prototype.setValue = function( value ){

    this._settingValue = true;
    this.colorPicker.setHex( value );
    this._settingValue = false;

    return this;

};

UI.ColorPicker.prototype.getValue = function(){

    return this.hex;

};

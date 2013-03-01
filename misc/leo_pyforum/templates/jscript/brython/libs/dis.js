//@+leo-ver=5-thin
//@+node:myleobook1.20130228000334.12291: * @file dis.js
//@@language javascript
$module = {
    __getattr__ : function(attr){
        if(attr in this){return this[attr]}
        else{$raise('AttributeError','module sys has no attribute '+attr)}
    },
    dis : function(src){return $py2js(src).to_js()}
}
$module.__class__ = $module // defined in $py_utils
$module.__str__ = function(){return "<module 'dis'>"}
//@-leo

//@+leo-ver=5-thin
//@+node:myleobook1.20130228000334.12293: * @file sys.js
//@@language javascript
$module = {
    __getattr__ : function(attr){
        if(attr==="stdout"){return document.$stdout}
        if(attr==="stderr"){return document.$stderr}
        else{return $getattr(this,attr)}
        },
    __setattr__ : function(attr,value){
        if(attr==="stdout"){document.$stdout=value}
        if(attr==="stderr"){document.$stderr=value}
        },
    has_local_storage:typeof(Storage)!=="undefined",
    version_info:[1,0,"20130111-000752"]
}
//@-leo

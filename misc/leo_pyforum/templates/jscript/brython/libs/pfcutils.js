//@+leo-ver=5-thin
//@+node:myleobook1.20130228000334.12292: * @file pfcutils.js
//@@language javascript
// 原來的 pfcUtils.js 內容, 改寫為 Brython pfcutils 模組

function isProEEmbeddedBrowser ()
{
  if (top.external && top.external.ptc)
    return true;
  else
    return false;
}

function pfcIsWindows ()
{
  if (navigator.appName.indexOf ("Microsoft") != -1)
    return true;
  else
    return false;
}

function pfcCreate (className)
{
	return new ActiveXObject ("pfc."+className);
	/*
  if (!pfcIsWindows())	
    netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");
  
  if (pfcIsWindows())
    return new ActiveXObject ("pfc."+className);
  else
    {
      ret = Components.classes ["@ptc.com/pfc/" + className + ";1"].
	  createInstance();
      return ret;
    }
	*/
}

function pfcGetProESession ()
{
  if (!isProEEmbeddedBrowser ())
    {
      throw new Error ("Not in embedded browser.  Aborting...");
    }
  
  // Security code
  if (!pfcIsWindows())
    netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");
  
  var glob = pfcCreate ("MpfcCOMGlobal");
  return glob.GetProESession();
}

function pfcGetScript ()
{  
  if (!isProEEmbeddedBrowser ())
    {
      throw new Error ("Not in embedded browser.  Aborting...");
    }
  
  // Security code
  if (!pfcIsWindows())
    netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");
  
  var glob = pfcCreate ("MpfcCOMGlobal");
  return glob.GetScript();
}


function pfcGetExceptionDescription (err)
{
 if (pfcIsWindows())
    errString = err.description;
 else
      errString = err.message;

 return errString;
}

function pfcGetExceptionType (err)
{
  errString = pfcGetExceptionDescription (err);

  // This should remove the XPCOM prefix ("XPCR_C")
  if (errString.search ("XPCR_C") < 0)
  {
	errString = errString.replace ("Exceptions::", "");
	semicolonIndex = errString.search (";");
	if (semicolonIndex > 0)
		errString = errString.substring (0, semicolonIndex);
	return (errString);
  }
  else
      return (errString.replace("XPCR_C", ""));
}

//*********** wl_header.js ****************** 函式開始
function WlProEStart()
{ 
  if (document.pwl == void null)
    {
      alert("Connect failed.");
      return ;
    }
}

function WlProEConnect()
//	Connect to a running Pro/ENGINEER session.
{
  WlProEStart();
}

function WlModelOpen()
//	Open a Pro/ENGINEER model.
{
  if (!pfcIsWindows())
    netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");
  if (document.main.ModelName.value == "")
    return ;
  var ret = document.pwl.pwlMdlOpen(document.main.ModelName.value,
				    document.main.ModelPath.value, true);
  if (!ret.Status)
    {
      if (ret.ErrorCode == -4 && document.main.ModelPath.value == "")
	return ;
      else
        {
	  alert("pwlMdlOpen failed (" + ret.ErrorCode + ")");
	  return ;
        }
    }
}

function WlModelRegenerate()
//	Regenerate the Pro/ENGINEER model.
{
  if (!pfcIsWindows())
    netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");
  var ret = document.pwl.pwlMdlRegenerate(document.main.ModelNameExt.value);
  if (!ret.Status)
    {
      alert("pwlMdlRegenerate failed (" + ret.ErrorCode + ")");
      return ;
    }
}

function WlModelSave()
//	Save a Pro/ENGINEER model.
{ 
  if (!pfcIsWindows())
    netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");
  var ret = document.pwl.pwlMdlSaveAs(document.main.ModelNameExt.value, void null, void null);
  if (!ret.Status)
    {
      alert("pwlMdlSaveAs failed (" + ret.ErrorCode + ")");
      return ;
    }
}

function WlModelSaveAs()
//	Save a Pro/ENGINEER model under a new name.
{
  if (!pfcIsWindows())
    netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");
  var NewPath = document.main.NewPath.value;
  var NewName = document.main.NewName.value;
  if (NewPath == "")
    {
      NewPath = void null;
    }
  if (NewName == "")
    {
      NewName = void null;
    }
  var ret = document.pwl.pwlMdlSaveAs(document.main.ModelNameExt.value,
				      NewPath, NewName);
  if (!ret.Status)
    {
      alert("pwlMdlSaveAs failed (" + ret.ErrorCode + ")");
      return ;
    }
}

function WlWindowRepaint()
//	Repaint the active window.
{
  if (!pfcIsWindows())
    netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");
  var get_ret = document.pwl.pwlWindowActiveGet();
  if (!get_ret.Status)
    {
      alert("pwlWindowActiveGet failed (" + get_ret.ErrorCode + ")");
      return ;
    }
  /* You can also repaint the active window using -1 as the window
     identifier. */
  var ret = document.pwl.pwlWindowRepaint(parseInt(get_ret.WindowID));
  if (!ret.Status)
    {
      alert("pwlWindowRepaint failed (" + ret.ErrorCode + ")");
      return ;
    }
}
//*********** ends wl_headerjs functions ***** 函式結束

function $pfc(){

    this.__getattr__ = function(attr){return $getattr(this,attr)}

		try
		{
		  if (!pfcIsWindows())
			netscape.security.PrivilegeManager.enablePrivilege("UniversalXPConnect");
		  
		  wpwl = pfcGetScript ();
		  document.pwl = wpwl;
		  wpwlc = wpwl.GetPWLConstants ();
		  document.pwlc = wpwlc;
		  wpwlf = wpwl.GetPWLFeatureConstants ();
		  document.pwlf = wpwlf;
		}
		catch (err)
		{
		  alert ("Exception caught:"+pfcGetExceptionType (err));
		}

    this.is_in_browser = function(){ return isProEEmbeddedBrowser()}
	this.is_windows = function(){ return pfcIsWindows ()}
	this.pfc_create = function(className){ return pfcCreate (className)}
    this.pfc_get_session = function(){ return pfcGetProESession ()}
	this.pfc_get_script = function (){ return pfcGetScript ()}
	this.pfc_get_exc_desp = function(err){ return  pfcGetExceptionDescription (err)}
	this.pfc_get_exc_type = function(err){ return pfcGetExceptionType (err)}

	this.test = function(){
        return "已經完成 pro/web.link 的呼叫"
	}
}

pfcutils = new $pfc()
$module = {
	__getattr__ : function(attr){return this[attr]},
	pfc : function(){return new $pfc()},
/*
    // 這裡的 shapedefs 採直接定義, 而非由外部的 shapeDefs 取得
    shapedefs : { __getattr__ : function(attr){return this[attr]},
                        circle : ['M', -0.5, 0, 'a', 0.5, 0.5, 0, 1, 0, 1, 0, 0.5, 0.5, 0, 1, 0, -                        1, 0],
                        square : ['M', -0.5, -0.5, 'l', 0, 1, 1, 0, 0, -1, 'z'],
                        triangle : ['M', -0.5, -0.289, 'l', 0.5, 0.866, 0.5, -0.866, 'z']
                    }
*/
}
$module.__class__ = $module // defined in $py_utils
$module.__str__ = function(){return "<module pfcutils'>"}
//@-leo

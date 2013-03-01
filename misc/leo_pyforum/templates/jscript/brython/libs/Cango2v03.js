//@+leo-ver=5-thin
//@+node:myleobook1.20130228000334.12290: * @file Cango2v03.js
//@@language javascript
/*=================================================================
  Filename: Cango2v03.js
  Rev: 2
  By: A.R.Collins
  Description: A graphics framework for the canvas element.
  License: Released into the public domain
  latest version at
  <http://www/arc.id.au/CanvasGraphics.html>
  Requires:
  if IE<9 - canvas emulator 'excanvas-modified.js' from
  <http://code.google.com/p/explorercanvas/downloads/list>.

  Date   |Description                                          |By
  -----------------------------------------------------------------
  14Oct12 Rev 1.00 First release based on Cango0v43             ARC
  23Oct12 bugfix: xRef,yRef not scaled in most compile methods
          don't pre-scale xRef, yRef in compile methods         ARC
  24Oct12 Give Obj2D methods to simplify compile methods        ARC
  25Oct12 Eliminated group etc. Just use arrays
          Renamed movePoints etc to translate, rotate, scale
          Pass render arguments to color functions              ARC
  26Oct12 Restored the xRef,yRef parameters to compileSvg cmds
          bugfix: restore scaling of font weight                ARC
  27Oct12 Removed iso commands - use 'iso' parameter instead
          bugfix: obj.translate and compileSvg used opposite
          sign conventions - switch compileSvg                  ARC
  11Nov12 removed Object.clone to avoid conflicts with 3rd
          party code (eg ACE editor)                            ARC
  19Nov12 Added to toWorldCoords                                ARC
  20Nov12 Added Obj2D.path to hold 'as rendered' coords
          Added Obj2D.dragNdrop, to hold Drag2D obj             ARC
  24Nov12 Added support for dragNdrop for rotated images
          Removed setRotation clearRotation capabilty           ARC
  25Nov12 Re-wrote paintPath to better use position transform
          Drag event handlers called in scope of dragNdrop obj
          Re-wrote paintImg to clarify draw origin offsets      ARC
  26Nov12 Added dragNdrop capability to TEXT objects            ARC
  27Nov12 Added Drag2D object, changed .path to .pxOutline
          Added 'as rendered' pxOrg (needed by enableDrag)      ARC
  29Nov12 Added parent as a Drag2D property                     ARC
          Released as Cango2v00                                 ARC
  30Nov12 Added Obj2D.setStrokeWidth
          Made drawPath scl factor permanent, used Obj2D.scale
          Made drawShape scl factor permanent, used Obj2D.scale ARC
  20Dec12 Enabled compileShape to accept numeric data           ARC
  02Jan13 Added stopAnimation,
          Removed animTranslate, animRotate, animScale          ARC
  10Jan13 有關中文字元 CMY
          因為內定字元是採用線段將 ASCII 字元畫出, 因此目前無法使用中文字型
		Yen 在最後加上 CangoAxes0v09.js
  =================================================================*/

// 這個用來追蹤畫布起始的全域變數, 必須設法與 Brython 中的 Python3 進行對應
  var _resized = new Array();   // keep track of which canvases are initialised

  var shapeDefs = {'circle':['M', -0.5, 0, 'a', 0.5, 0.5, 0, 1, 0, 1, 0, 0.5, 0.5, 0, 1, 0, -1, 0],
                   'square':['M', -0.5, -0.5, 'l', 0, 1, 1, 0, 0, -1, 'z'],
                   'triangle':['M', -0.5, -0.289, 'l', 0.5, 0.866, 0.5, -0.866, 'z']};

// 當 Javascript 的事件處理不再是主體, 而是由外部的 Brython Python3 事件所主導
// 照理說應該要將相關的滑鼠事件設為參數, 並且由 Python3 主導後傳進 Javascript 相關物件函式
// step 1 register Cango2v03 to brython.js (20130111 已經無須註冊, 只要放到 libs 目錄中)
// 以下兩行的舊設定, 已經作廢
// function $import(){
// var js_modules=$List2Dict('time','datetime','dis','math','random','sys','Cango2v03')
// step 2 add Cango2v03 object ( 20130111 起必須採用 $module 寫法)
$module = {
	__getattr__ : function(attr){return this[attr]},
	cango : function(canvasId){return new Cango(canvasId)},
    drag2d : function(cangoGC, grabFn, dragFn, dropFn){return new Drag2D(cangoGC, grabFn, dragFn, dropFn)},
    // 這裡的 shapedefs 採直接定義, 而非由外部的 shapeDefs 取得
    shapedefs : { __getattr__ : function(attr){return this[attr]},
                        circle : ['M', -0.5, 0, 'a', 0.5, 0.5, 0, 1, 0, 1, 0, 0.5, 0.5, 0, 1, 0, -                        1, 0],
                        square : ['M', -0.5, -0.5, 'l', 0, 1, 1, 0, 0, -1, 'z'],
                        triangle : ['M', -0.5, -0.289, 'l', 0.5, 0.866, 0.5, -0.866, 'z']
                    }
}
$module.__class__ = $module // defined in $py_utils
$module.__str__ = function(){return "<module 'Cango2v03'>"}

// original Cango object function
  function Cango(canvasId)
  {
    this.cId = canvasId;
    this.cnvs = document.getElementById(canvasId);
    if (this.cnvs == null)
    {
      alert("can't find canvas "+canvasId);
      return
    }
    this.rawWidth = this.cnvs.offsetWidth;
    this.rawHeight = this.cnvs.offsetHeight;
    this.aRatio = this.rawWidth/this.rawHeight;

    if (!(this.cId in _resized))
    {
      // make canvas native aspect ratio equal style box aspect ratio.
      // Note: rawWidth and rawHeight are floats, assignment to ints will truncate
      this.cnvs.setAttribute('width', this.rawWidth);    // this actually resets number of graphics pixels
      this.cnvs.setAttribute('height', this.rawHeight);  // don't use style for this

      // create element for this canvas, this prevents resize for each Cango instance
      _resized[this.cId] = true;
    }

    this.ctx = this.cnvs.getContext('2d');
    this.ctx.save();

    this.vpW = this.rawWidth;         // vp width in pixels (default to full canvas size)
    this.vpH = this.rawHeight;        // vp height in pixels
    this.vpLLx = 0;                   // vp lower left from canvas left in pixels
    this.vpLLy = this.rawHeight;      // vp lower left from canvas top
    this.xscl = this.rawWidth/100;    // world x axis scale factor, default canvas width = 100 (viewport units)
    this.yscl = -this.rawWidth/100;   // world y axis scale factor, default +ve up, canvas height =100*aspect ratio (viewport units)
    this.xoffset = 0;                 // world x origin offset from viewport left in pixels
    this.yoffset = 0;                 // world y origin offset from viewport bottom in pixels
    // *** to move to world coord x,y ***
    // 1. from pixel x origin (canvas left) add vpLLx (gets to viewport left)
    // 2. add xoffset to get to pixel location of world x origin
    // 3. add x*xscl pixels to get to world x location.
    // ==> x (in world coords) == vpLLx + xoffset + x*xscl (pixels location on canvas)
    // ==> y (in world coords) == vpLLy + yoffset + y*xscl (pixels location on canvas).
    this.penCol = "rgba(0, 0, 0, 1.0)";        // black
    this.penWid = 1;                  // pixels
    this.lineCap = "butt";
    this.paintCol = "rgba(128, 128, 128, 1.0)";  // gray
    this.fontSize = 10;               // 10pt
    this.fontWeight = 400;            // 100..900, 400 = normal,700 = bold
    this.timer = [];                  // animation timer
    this.intTimer = [];               // animation loop interval timer
    this.tickInt = 50;                // animation tick interval (in msec)
    this.objType = {PATH:0, SHAPE:1, TEXT:2, IMG:3};   // access by 'this.objType.XXXX'
    this.draggable = [];    // array of Obj2Ds that are draggable
    this.currDrag = null;   // Obj2D that is being dragged

    // step 3 add __getattr__ function to Cango object (20130111 起必須放到物件中)
    this.__getattr__ = function(attr){return $getattr(this,attr)}

    var savThis = this;

    this.cnvs.onmousedown = function(event)
    {
      var event = event || window.event;
      var crsPos = savThis.getCursorPos(event);

      function hitTest(pathObj)
      {
        // create the path (don't stroke it - noone will see) to test for hit
        var worldCoords = [];
        savThis.ctx.beginPath();
        for (var i=0; i<pathObj.pxOutline.length; i++)
        {
          savThis.ctx[pathObj.pxOutline[i].drawFn].apply(savThis.ctx, pathObj.pxOutline[i].parms);
        }
        // for diagnostics on hit region, put savThis.ctx.stroke();  in here
        return savThis.ctx.isPointInPath(crsPos.x, crsPos.y);
      }
      // run through all the registered objects and test if cursor pos is in their path
      for (var i = 0; i<savThis.draggable.length; i++)
      {
        if (hitTest(savThis.draggable[i]))
        {
          savThis.currDrag = savThis.draggable[i];     // assign Obj2D that is being dragged
          savThis.currDrag.dragNdrop.grab(event);
        }
      }
    }
  }
  
  // step 3 add __getattr__ function to Cango object (已經作廢, 20130111 起必須放到物件中)
  //Cango.prototype.__getattr__ = function(attr){return getattr(this,attr)}
  
  Cango.prototype.resetCtx = function()
  {
    // reset drawing defaults
    this.ctx.strokeStyle = this.penCol;
    this.ctx.fillStyle = this.paintCol;
    this.ctx.lineWidth = this.penWid;
    this.ctx.lineCap = this.lineCap;
  }

  Cango.prototype.toViewportCoords = function(x, y)
  {
    // transform x,y in world coords to viewport coords (x axis 0 to 100, y axis same scale factor)
    var xPx = this.vpLLx+this.xoffset+x*this.xscl;
    var yPx = this.vpLLy+this.yoffset+y*this.yscl;

    return {x: 100*xPx/this.rawWidth, y: 100*(this.rawHeight-yPx)/this.rawWidth};
  }

  Cango.prototype.toPixelCoords = function(x, y)
  {
    // transform x,y in world coords to canvas pixel coords (top left is 0,0 y axis +ve down)
    var xPx = this.vpLLx+this.xoffset+x*this.xscl;
    var yPx = this.vpLLy+this.yoffset+y*this.yscl;

    return {x: xPx, y: yPx};
  }

  Cango.prototype.toWorldCoords = function(xPx, yPx)
  {
    // transform xPx,yPx in raw canvas pixels to world coords (lower left is 0,0 +ve up)
    var xW = (xPx - this.vpLLx - this.xoffset)/this.xscl;
    var yW = (yPx - this.vpLLy - this.yoffset)/this.yscl;
    // Yen Step 4, to make the return Brythonized
    return {__getattr__ : function(attr){return this[attr]},
                x: xW, y: yW};
  }

  Cango.prototype.getCursorPos = function(e)
  {
    // pass in any mouse event, returns the position of the cursor in raw pixel coords
    var e = e||window.event;
    var rect = this.cnvs.getBoundingClientRect();

    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  Cango.prototype.clearCanvas = function()
  {
    this.ctx.clearRect(0, 0, this.rawWidth, this.rawHeight);
    // all drawing erased, but graphics contexts remain intact
    // clear the draggable array, drabbles put back when rendered
    this.draggable = [];
    this.currDrag = null;
  }

  Cango.prototype.setViewport = function(lowerLeftX, lowerLeftY, w, h)
  {
    if (h != undefined)
    {
      this.vpW = 0.01*w*this.rawWidth;
      this.vpH = 0.01*h*this.rawWidth;
      this.vpLLx = 0.01*lowerLeftX*this.rawWidth;
      this.vpLLy = this.rawHeight-0.01*lowerLeftY*this.rawWidth;
    }
    else
    {
      this.vpW = this.rawWidth;
      this.vpH = this.rawHeight;
      this.vpLLx = 0;
      this.vpLLy = this.rawHeight;
    }
    this.setWorldCoords();     // if new viewport, world coords are garbage, so reset to defaults
  }

  Cango.prototype.clearViewport = function()
  {
    // Not supported by excanvas, which implements clearRect by 'deleteNode'
    this.ctx.clearRect(this.vpLLx, this.vpLLy - this.vpH, this.vpW, this.vpH); // referenced from top left corner
  }

  Cango.prototype.fillViewport = function(fillColor)
  {
    var newCol = this.paintCol;
    // set background color and fill the viewport to that color or gradient /
    if ((fillColor != undefined)&&(fillColor != null))
    {
      if ((typeof fillColor == "object")||(typeof fillColor == "string"))  // test for gradient or CSS string
        newCol = fillColor;
    }

    this.ctx.fillStyle = newCol;
    this.ctx.fillRect(this.vpLLx, (this.vpLLy-this.vpH), this.vpW, this.vpH); // fill referenced from top left corner
    this.ctx.fillStyle = this.paintCol;    // restore default
  }

  Cango.prototype.setWorldCoords = function(leftX, rightX, lowerY, upperY)
  {
    if (upperY != undefined)
    {
      this.xscl = this.vpW/(rightX-leftX);
      this.yscl = -(this.vpH/(upperY-lowerY));
      this.xoffset = -leftX*this.xscl;
      this.yoffset = -lowerY*this.yscl;
    }
    else
    {
      this.xscl = this.rawWidth/100;    // makes xaxis = 100 native units
      this.yscl = -this.rawWidth/100;   // makes yaxis = 100*aspect ratio ie. square pixels
      this.xoffset = 0;
      this.yoffset = 0;
    }
    // world coords have changed, reset pen world coords
		this.penX = 0;
		this.penY = 0;
  }

  Cango.prototype.setPenColor = function(color)
  {
    if ((typeof color == "undefined")||(color == null))
    {
      this.penCol = "rgba(0, 0, 0, 1.0)";        // black
    }
    else    // some color has been passed
    {
      if ((typeof color == "object")||(typeof color == "string"))  // test for gradient object or CSS string
        this.penCol = color;
      // else a number or something else invalid, so penCol doesn't change
    }

    this.ctx.strokeStyle = this.penCol;
  }

  Cango.prototype.setPaintColor = function(color)
  {
    if ((typeof color == "undefined")||(color == null))
    {
      this.paintCol = "rgba(127, 127, 127, 1.0)";        // gray
    }
    else    // some color has been passed
    {
      if ((typeof color == "object")||(typeof color == "string"))  // test for gradient object or CSS string
        this.paintCol = color;
      // else a number or something else invalid, so paintCol doesn't change
    }

    this.ctx.fillStyle = this.paintCol;
  }

  Cango.prototype.setPenWidth = function(w)    // w in screen px
  {
    if (typeof w != "undefined")
      this.penWid = w;

    this.ctx.lineWidth = this.penWid;
  }

  Cango.prototype.setLineCap = function(c)    // c = 'butt', 'round' or 'square'
  {
    if (typeof c == "undefined")
      this.lineCap = "butt";
    else if ((c == "butt")||(c =="round")||(c == "square"))
      this.lineCap = c;

    this.ctx.lineCap = this.lineCap;
  }

  Cango.prototype.setFontSize = function(s)    // s in points
  {
    if (typeof s != "undefined")
      this.fontSize = s;
  }

  Cango.prototype.setFontWeight = function(w)    // s in points
  {
    if ((typeof w != "undefined")&&(w>99)&&(w<901))
      this.fontWeight = w;
  }

  Cango.prototype.setTickInterval = function(i)    // i in msec
  {
    if ((typeof i != "undefined")&&(i >= 20))
      this.tickInt = i;
  }

  Cango.prototype.linearGradientFill = function(x1, y1, x2, y2, x, y, scl, isotropic)
  {
    var xOfs = x || 0;
    var yOfs = y || 0;
    var xScl = scl || 1;
    var yScl = scl || 1;
    if ((typeof isotropic != 'undefined')&&(isotropic == 'iso'))
      yScl *= -this.xscl/this.yscl;
    // pixel version of world coordinate parms
    var p1x = xOfs+x1*xScl;
    var p1y = yOfs+y1*yScl;
    var p2x = xOfs+x2*xScl;
    var p2y = yOfs+y2*yScl;

    return this.ctx.createLinearGradient(this.xscl*p1x, this.yscl*p1y, this.xscl*p2x, this.yscl*p2y);
  }

  Cango.prototype.radialGradientFill = function(x1, y1, r1, x2, y2, r2, x, y, scl, isotropic)
  {
    var xOfs = x || 0;
    var yOfs = y || 0;
    var xScl = scl || 1;
    var yScl = scl || 1;
    if ((typeof isotropic != 'undefined')&&(isotropic == 'iso'))
      yScl *= -this.xscl/this.yscl;
    // world coordinate parms (equivalent to compile methods)
    var p1x = xOfs+x1*xScl;
    var p1y = yOfs+y1*yScl;
    var p1r = r1*this.xscl*xScl;
    var p2x = xOfs+x2*xScl;
    var p2y = yOfs+y2*yScl;
    var p2r = r2*this.xscl*xScl;

    return this.ctx.createRadialGradient(this.xscl*p1x, this.yscl*p1y, p1r, this.xscl*p2x, this.yscl*p2y, p2r);
  }

  Cango.prototype.render = function(pathObj, x, y, scl, degs)
  {
    var savThis = this;      // save 'this' for the closure when called back
    // this function returns the event handler fn (no parameters passed),
    // it maintains the scope so inner function variables are valid
    function loadCallback(obj, x, y, scl, degs)
    {
      return  function(){savThis._paintImg(obj, x, y, scl, scl, degs);}
    }
    // test for an array or just a single path
    if (pathObj instanceof Array)          // array of Obj2D
    {
      for (var i=0; i<pathObj.length; i++)
      {
        if (pathObj[i].type == this.objType.IMG)
        {
          if (pathObj[i].width>0)  // image loaded and width set?
            this._paintImg(pathObj[i], x, y, scl, scl, degs);
          else
            addLoadEvent(pathObj[i].drawCmds, loadCallback(pathObj[i], x, y, scl, degs));
        }
        else    // PATH, SHAPE or TEXT
          this._paintPath(pathObj[i], x, y, scl, scl, degs);
      }
    }
    else
    {
      if (pathObj.type == this.objType.IMG)
      {
        if (pathObj.width>0)  // image loaded, and width set?
          this._paintImg(pathObj, x, y, scl, scl, degs);
        else
          addLoadEvent(pathObj.drawCmds, loadCallback(pathObj, x, y, scl, degs));
      }
      else    // PATH, SHAPE or TEXT
        this._paintPath(pathObj, x, y, scl, scl, degs);
    }
  }

  Cango.prototype._paintImg = function(pathObj, x, y, xScl, yScl, degrees)
  {
    // should only be called after image has been loaded into drawCmds
    var img = pathObj.drawCmds;            // this is the place the image is stored in object
    var w = pathObj.width;                 // this is the original requested width in world coords
    var xPos = (typeof(x)!='undefined' && x!=null)? x : 0;
    var yPos = (typeof(y)!='undefined' && y!=null)? y : 0;
    var scale = (typeof(xScl)!='undefined' && xScl!=null)? xScl : 1;
    var dgs = (typeof(degrees)!='undefined' && degrees!=null)? degrees : 0;
    var degs = dgs + pathObj.imgDegs;
    var lorg = pathObj.lorg;        // can't have 0 either
    var xScale = scale*pathObj.imgXscale;  // imgXscale is from Obj2D.scale (permanent)

    this.ctx.save();   // save the clean ctx
    // move the whole coordinate system to the xPos,yPos
    this.ctx.translate(this.vpLLx+this.xoffset+xPos*this.xscl, this.vpLLy+this.yoffset+yPos*this.yscl);
    if (degs)
      this.ctx.rotate(-degs*Math.PI/180.0);   // rotate
    // now insert the image at the rotation radius from the origin and scaled in width
    this.ctx.drawImage(img, this.xscl*xScale*pathObj.imgX, this.xscl*xScale*pathObj.imgY, this.xscl*xScale*img.width*w/img.width, this.xscl*xScale*img.height*w/img.width);
    this.ctx.restore();    // undo the transforms

    // make a hitRegion boundary path around the image to be checked on mousedown
    var ulx = this.xscl*xScale*pathObj.imgX;
    var uly = this.xscl*xScale*pathObj.imgY;
    var urx = this.xscl*xScale*(pathObj.imgX+img.width*w/img.width);
    var ury = uly;
    var lrx = urx;
    var lry = this.xscl*xScale*(pathObj.imgY+img.height*w/img.width);
    var llx = ulx;
    var lly = lry;

    var vul = [ulx, uly];
    var vur = [urx, ury];
    var vlr = [lrx, lry];
    var vll = [llx, lly];
    // if the image has been rotated then rotate the bounding box
    if (degs)
    {
      var A = -Math.PI*degs/180.0;   // radians
      var sinA = Math.sin(A);
      var cosA = Math.cos(A);
      function rotXY(x,y){return [x*cosA - y*sinA, x*sinA + y*cosA]};
      vul = rotXY(ulx, uly);
      vur = rotXY(urx, ury);
      vlr = rotXY(lrx, lry);
      vll = rotXY(llx, lly);
    }
    // now form the DrawCmds and translate the vertices
    var drawOrgX = this.vpLLx+this.xoffset+this.xscl*xPos;
    var drawOrgY = this.vpLLy+this.yoffset+this.yscl*yPos;
    function moveXY(v){ return [drawOrgX+v[0], drawOrgY+v[1]] };
    pathObj.pxOutline = [];   // start with new array
    pathObj.pxOutline[0] = new DrawCmd('moveTo', moveXY(vul));
    pathObj.pxOutline[1] = new DrawCmd('lineTo', moveXY(vur));
    pathObj.pxOutline[2] = new DrawCmd('lineTo', moveXY(vlr));
    pathObj.pxOutline[3] = new DrawCmd('lineTo', moveXY(vll));
    pathObj.pxOutline[4] = new DrawCmd('closePath');
    pathObj.pxOrgX = this.vpLLx+this.xoffset+xPos*this.xscl;
    pathObj.pxOrgY = this.vpLLy+this.yoffset+yPos*this.yscl;

    if (pathObj.dragNdrop != null)
    {
      // save drawing pixel coords of the drawing origin (often useful in drag n drop)
      pathObj.dragNdrop.xOrg = pathObj.pxOrgX;
      pathObj.dragNdrop.yOrg = pathObj.pxOrgY;
      // now push it into Cango.draggable array, its checked by canvas mousedown event handler
      this.draggable.push(pathObj);
    }
  }

  Cango.prototype._paintPath = function(pathObj, x, y, xScl, yScl, degrees)
  {
    // used for objType: PATH, SHAPE or TEXT
    var xPos = (typeof(x)!='undefined' && x!=null)? x : 0;
    var yPos = (typeof(y)!='undefined' && y!=null)? y : 0;
    var xScale = (typeof(xScl)!='undefined' && xScl!=null)? xScl : 1;
    var yScale = (typeof(yScl)!='undefined' && yScl!=null)? yScl : 1;
    var degs = (typeof(degrees)!='undefined' && degrees!=null)? degrees : 0;
    var fill = null;
    var pxlCoords = [];
    var i, j;
    // if type TEXT then translate, rotate, scale must be handled at render time
    if (pathObj.type == this.objType.TEXT)
    {
      degs += pathObj.imgDegs;
      xScale *= pathObj.imgXscale;
      yScale *= pathObj.imgYscale;
    }

    this.ctx.save();   // save current rotation if any
    this.ctx.translate(this.vpLLx+this.xoffset+xPos*this.xscl, this.vpLLy+this.yoffset+yPos*this.yscl);
    this.ctx.scale(xScale, yScale);
    this.ctx.save();   // save current rotation if any
    if (degs)
      this.ctx.rotate(-degs*Math.PI/180.0);

    this.ctx.beginPath();
    for (i=0; i<pathObj.drawCmds.length; i++)
    {
      for (j=0; j<pathObj.drawCmds[i].parms.length; j+=2)  // convert x,y coord pairs to pixel coords
      {
        pxlCoords[j] = this.xscl*pathObj.drawCmds[i].parms[j];
        if (pathObj.iso)
          pxlCoords[j+1] = -this.xscl*pathObj.drawCmds[i].parms[j+1];
        else
          pxlCoords[j+1] = this.yscl*pathObj.drawCmds[i].parms[j+1];
      }
      this.ctx[pathObj.drawCmds[i].drawFn].apply(this.ctx, pxlCoords); // actually draw the path
    }
    // undo the rotation before fill so pattern not rotated
    this.ctx.restore();

    // if a shape fill with color
    if (pathObj.type == this.objType.SHAPE)
    {
      // pathObj.fillCol may be a function that generates dynamic color (so call it)
      if (pathObj.fillCol instanceof Function)
        fill = pathObj.fillCol(arguments);
      else
        fill = pathObj.fillCol;
      this.ctx.fillStyle = fill;
      this.ctx.fill();
    }
    // try to avoid calling color function twice
    if ((pathObj.fillCol == pathObj.strokeCol)&&(fill != null))
      this.ctx.strokeStyle = fill;
    else
    {
      // pathObj.fillCol may be a function that generates dynamic color (so call it)
      if (pathObj.strokeCol instanceof Function)
        this.ctx.strokeStyle = pathObj.strokeCol(arguments);
      else
        this.ctx.strokeStyle = pathObj.strokeCol;
    }
    this.ctx.lineWidth = Math.abs(pathObj.strokeWidth); // strokeWidth set at compile time
    this.ctx.lineCap = pathObj.strokeCap;
    this.ctx.stroke();
    // undo the translation and scaling
    this.ctx.restore();
    this.resetCtx();   // restore the styles styles

    // construct the 'as rendered' ouline of the object in pixels coords for mouse event detection
    // if the path has been rotated set up some tools to rotate the pixel coords
    if (degs)
    {
      var A = -Math.PI*degs/180.0;   // radians
      var sinA = Math.sin(A);
      var cosA = Math.cos(A);
      function rotXY(x,y){return [x*cosA - y*sinA, x*sinA + y*cosA]};
    }
    pathObj.pxOutline = [];   // start with new array
    // scale and translate to pixel coords (save these for drag and drop testing)
    pathObj.pxOrgX = this.vpLLx+this.xoffset+xPos*this.xscl;
    pathObj.pxOrgY = this.vpLLy+this.yoffset+yPos*this.yscl;
    if (pathObj.type == this.objType.TEXT)
    {
      // make a boundary path around the image
      var ulx = this.xscl*xScale*pathObj.imgX;
      var uly = -this.xscl*xScale*pathObj.imgY;
      var urx = this.xscl*xScale*(pathObj.imgX+pathObj.width);
      var ury = uly;
      var lrx = urx;
      var lry = -this.xscl*xScale*(pathObj.imgY+pathObj.height);
      var llx = ulx;
      var lly = lry;

      var vul = [ulx, uly];
      var vur = [urx, ury];
      var vlr = [lrx, lry];
      var vll = [llx, lly];
      // if the image has been rotated then rotate the bounding box
      if (degs)
      {
        vul = rotXY(ulx, uly);
        vur = rotXY(urx, ury);
        vlr = rotXY(lrx, lry);
        vll = rotXY(llx, lly);
      }
      // now form the DrawCmds and translate the vertices
      function moveXY(v){ return [pathObj.pxOrgX+v[0], pathObj.pxOrgY+v[1]] };
      pathObj.pxOutline = [];   // start with new array
      pathObj.pxOutline[0] = new DrawCmd('moveTo', moveXY(vul));
      pathObj.pxOutline[1] = new DrawCmd('lineTo', moveXY(vur));
      pathObj.pxOutline[2] = new DrawCmd('lineTo', moveXY(vlr));
      pathObj.pxOutline[3] = new DrawCmd('lineTo', moveXY(vll));
      pathObj.pxOutline[4] = new DrawCmd('closePath');
    }
    else
    {
      for (i=0; i<pathObj.drawCmds.length; i++)
      {
        var pxCoords = [];
        for (j=0; j<pathObj.drawCmds[i].parms.length; j+=2)      // convert x,y coord pairs to world coords
        {
          pxCoords[j] = xScale*pathObj.drawCmds[i].parms[j]*this.xscl;
          if (pathObj.iso)
            pxCoords[j+1] = yScale*pathObj.drawCmds[i].parms[j+1]*-this.xscl;
          else
            pxCoords[j+1] = yScale*pathObj.drawCmds[i].parms[j+1]*this.yscl;
          if (degs)
          {
            var v = rotXY(pxCoords[j], pxCoords[j+1]);
            pxCoords[j] = v[0];
            pxCoords[j+1] = v[1];
          }
          pxCoords[j] += pathObj.pxOrgX;   // position path by adding the coordinates of the drawing origin
          pxCoords[j+1] += pathObj.pxOrgY;
        }
        pathObj.pxOutline.push(new DrawCmd(pathObj.drawCmds[i].drawFn, pxCoords));
      }
    }
    if (pathObj.dragNdrop != null)
    {
      // save pixel coords of the drawing origin (often useful in drag n drop)
      pathObj.dragNdrop.xOrg = pathObj.pxOrgX;
      pathObj.dragNdrop.yOrg = pathObj.pxOrgY;
      // now push it into Cango.draggable array, its checked by canvas mousedown event handler
      this.draggable.push(pathObj);
    }
  }

  Cango.prototype.compilePath = function(path, color, isotropic, drag)
  {
    /* this is a preprocessor to convert an array of svg Path syntax letters
       and numbers into 'segs' format, it treats a simple set of numbers as a
       special case, with an initial 'M' then the rest as 'L' pairs
       segs = [ ['M', c, c], ['L', c, c, c, c ..], [], []... ];
      which are then compiled to canvas drawCmd objects ready to render */
    if (!(path instanceof Array))
      return;

    var iso = false;
    if ((typeof isotropic != 'undefined')&&(isotropic == 'iso'))
      iso = true;

    var segs = [];
    var i, j;
    // special case of data only array. Test if 1st element is a number then
    // treat array as 'M', x0, y0, 'L', x1, y1, x2, y2, ... ]
    if (typeof path[0] == 'number')
    {
      segs[0] = ['M', path[0], path[1]];
      var lineSeg = ['L'];
      for (j=2,i=2; i<path.length; i++)
      {
        if (typeof path[i] != 'number')
          break;
      }
      segs[1] = lineSeg.concat(path.slice(j,i));
    }
    else
    {
      for(j=0, i=1; i<path.length; i++)
      {
        if (typeof path[i] == 'string')
        {
          segs.push(path.slice(j,i));
          j = i;
        }
      }
      segs.push(path.slice(j,i));    // push the last command out
    }
    // now send these off to the svg segs to canvas DrawCmd processor
    var cvsCmds = this.segsToDrawCmds(segs);
    var pathObj = new Obj2D(this, cvsCmds, this.objType.PATH, iso, null, color, null, drag);

    return pathObj;
  }

  Cango.prototype.compileShape = function(path, fillColor, strokeColor, isotropic, drag)
  {
    // this is a preprocessor to convert an array of svg Path syntax letters and numbers into 'segs' format
    // segs = [ ['M', c, c], ['L', c, c, c, c ..], [], []... ];
    // which are then compiled to canvas drawCmd objects ready to render
    if (!(path instanceof Array))
      return;

    var iso = false;
    if ((typeof isotropic != 'undefined')&&(isotropic == 'iso'))
      iso = true;

    var segs = [];
    var i, j;
    // special case of data only array. Test if 1st element is a number then
    // treat array as 'M', x0, y0, 'L', x1, y1, x2, y2, ... ]
    if (typeof path[0] == 'number')
    {
      segs[0] = ['M', path[0], path[1]];
      var lineSeg = ['L'];
      for (j=2,i=2; i<path.length; i++)
      {
        if (typeof path[i] != 'number')
          break;
      }
      segs[1] = lineSeg.concat(path.slice(j,i));
    }
    else
    {
      for(j=0, i=1; i<path.length; i++)
      {
        if (typeof path[i] == 'string')
        {
          segs.push(path.slice(j,i));
          j = i;
        }
      }
      segs.push(path.slice(j,i));    // push the last command out
    }
    // now send these off to the svg segs-to-canvas DrawCmd processor
    var cvsCmds = this.segsToDrawCmds(segs);
    var pathObj = new Obj2D(this, cvsCmds, this.objType.SHAPE, iso, fillColor, strokeColor, null, drag);

    return pathObj;
  }

  Cango.prototype.compileText = function(str, ptSize, lorigin, drag)
  {
    if (typeof str != 'string')
      return;

    var lorg = lorigin || 1;
    var size = ptSize || this.fontSize;
    var lineWidth = 0.08*size*this.fontWeight/400;    // =2*size/25 (see CanvasTextFuctions.draw)

    size /= this.xscl;    // independent of world coord scaling, set size by point size
    var mag = size/25;    // size/25 is worlds coords scaled to stored font size

    var cmdObj;
    var commands = [];
    var xLofs = 0;  // offset from top left to the lorg point (drawing origin)
    var yLofs = 0;

    var strWidth = CanvasTextFunctions.measure(0, size, str);
    // Note: char cell is 33 pixels high, char size is 21 pixels (0 to 21), decenders go to -7 to 21.
    //   passing 'size' to text function scales char height by size/25.
    //   So reference height for vertically alignment is charHeight = 21/25 (=0.84) of the fontSize.
    var strHeight = 0.84*size;
    switch (lorg)
    {
      case 1:
      default:
        xLofs = 0;
        yLofs = strHeight;
        break;
      case 2:
        xLofs = 0.5*strWidth;
        yLofs = strHeight;
        break;
      case 3:
        xLofs = strWidth;
        yLofs = strHeight;
        break;
      case 4:
        xLofs = 0;
        yLofs = 0.5*strHeight;
        break;
      case 5:
        xLofs = 0.5*strWidth;
        yLofs = 0.5*strHeight;
        break;
      case 6:
        xLofs = strWidth;
        yLofs = 0.5*strHeight;
        break;
      case 7:
        xLofs = 0;
        yLofs = 0;
        break;
      case 8:
        xLofs = 0.5*strWidth;
        yLofs = 0;
        break;
      case 9:
        xLofs = strWidth;
        yLofs = 0;
        break;
    }

    var dx = -xLofs;    // start path by adding in the lorg offset to drawing origin
    var dy = -yLofs;
    for (var i = 0; i < str.length; i++)
    {
    	var c = CanvasTextFunctions.letter(str.charAt(i));
    	if (!c)
        continue;
    	var penUp = 1;
    	for (var j = 0; j < c.points.length; j++)
      {
    	  var a = c.points[j];
    	  if ((a[0] == -1) && (a[1] == -1))
        {
      		penUp = 1;
      		continue;
    	  }
    	  if (penUp == 1)
        {
          cmdObj = new DrawCmd('moveTo', [dx + a[0]*mag, dy + a[1]*mag]);
          commands.push(cmdObj);
      		penUp = 0;
    	  }
        else
        {
          cmdObj = new DrawCmd('lineTo', [dx + a[0]*mag, dy + a[1]*mag]);
          commands.push(cmdObj);
     	  }
    	}
    	dx += c.width*mag;
    }
    // iso = true for all TEXT
    var pathObj = new Obj2D(this, commands, this.objType.TEXT, true, null, null, lorg, drag);
    pathObj.strokeWidth = lineWidth;    // normal weight stroke width is saved
    pathObj.imgX = -xLofs;     // save offset (pxl coords = world coords) to draw bounding box
    pathObj.imgY = -yLofs;
    pathObj.width = strWidth;
    pathObj.height = strHeight;

    return pathObj;
  }

  Cango.prototype.compileImg = function(imgURL, w, lorigin, drag)
  {
    if (typeof imgURL != 'string')
      return;

    var savThis = this;

    var lorg = lorigin || 1;
    var img = new Image();
    var imgObj = new Obj2D(this, img, this.objType.IMG, true, null, null, lorg, drag);   // iso=true, colors=null

    function onloadCallback(obj, w)
    {
      return  function()
              {
                var width = w || obj.drawCmds.width;    // its loaded now so width is valid
                obj.width = width;   // imgObj.width may have been 0 so set it
                obj.height = width*obj.drawCmds.height/obj.drawCmds.width;  // keep aspect ratio
                switch (lorg)
                {
                  case 1:
                    xLofs = 0;
                    yLofs = 0;
                    break;
                  case 2:
                    xLofs = 0.5*obj.width;          // work in pixels assume image already scaled
                    yLofs = 0;
                    break;
                  case 3:
                    xLofs = obj.width;
                    yLofs = 0;
                    break;
                  case 4:
                    xLofs = 0;
                    yLofs = 0.5*obj.height;
                    break;
                  case 5:
                    xLofs = 0.5*obj.width;
                    yLofs = 0.5*obj.height;
                    break;
                  case 6:
                    xLofs = obj.width;
                    yLofs = 0.5*obj.height;
                    break;
                  case 7:
                    xLofs = 0;
                    yLofs = obj.height;
                    break;
                  case 8:
                    xLofs = 0.5*obj.width;
                    yLofs = obj.height;
                    break;
                  case 9:
                    xLofs = obj.width;
                    yLofs = obj.height;
                    break;
                  default:
                    xLofs = 0;
                    yLofs = 0;
                }
                obj.imgX = -xLofs;
                obj.imgY = -yLofs;
              }
    }
    imgObj.drawCmds.src = "";
    addLoadEvent(imgObj.drawCmds, onloadCallback(imgObj, w));
    // start to load the image
    imgObj.drawCmds.src = imgURL;

    return imgObj;
  }

  Cango.prototype.compileSvgPath = function(svgPath, color, xRef, yRef, drag)
  {
    if (typeof svgPath != 'string')
      return;
    // this is a preprocessor to get an svg Path string into 'Obj2D' format
    var segs = [];
    var cmd, seg, cmdLetters, coords;
    var strs = svgPath.split(/(?=[a-df-z])/i);  // avoid e in exponents
    // now array of strings with command letter start to each

    for (var i=0; i<strs.length; i++)
    {
      seg = strs[i];
      // get command letter into an array
      cmdLetters = seg.match(/[a-z]/i);
      if (!cmdLetters)
        return [];
      cmd = cmdLetters.slice(0,1);
      if ((i==0)&&(cmd[0] != 'M'))   // check that the first move is absolute
        cmd[0] = 'M';
      coords = seg.match(/[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?/gi);
      if (coords)
        coords = coords.map(parseFloat);
      segs.push(cmd.concat(coords));
    }
    // now send these off to the svg segs to canvas DrawCmd processor

    var xScale = 1;
    var yScale = -1;                        // flip all the y coords to +ve up
    var xOfs = xRef || 0;                 // move the shape reference point
    var yOfs = -yRef || 0;

    var drawCommands = this.segsToDrawCmds(segs, xOfs, yOfs, xScale, yScale);
    // svg path are iso=true
    var pathObj = new Obj2D(this, drawCommands, this.objType.PATH, true, null, color, null, drag);

    return pathObj;
  }

  Cango.prototype.compileSvgShape = function(svgPath, fillColor, strokeColor, xRef, yRef, drag)
  {
    if (typeof svgPath != 'string')
      return;
    // this is a preprocessor to get an svg Path string into 'Obj2D' format
    var segs = [];
    var cmd, seg, cmdLetters, coords;
    var strs = svgPath.split(/(?=[a-df-z])/i);  // avoid e in exponents
    // now array of strings with command letter start to each

    for (var i=0; i<strs.length; i++)
    {
      seg = strs[i];
      // get command letter into an array
      cmdLetters = seg.match(/[a-z]/i);
      if (!cmdLetters)
        return [];
      cmd = cmdLetters.slice(0,1);
      if ((i==0)&&(cmd[0] != 'M'))   // check that the first move is absolute
        cmd[0] = 'M';
      coords = seg.match(/[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?/gi);
      if (coords)
        coords = coords.map(parseFloat);
      segs.push(cmd.concat(coords));
    }
    // now send these off to the svg segs to canvas DrawCmd processor
    var xScale = 1;
    var yScale = -1;                        // flip all the y coords to +ve up
    var xOfs = xRef || 0;                 // move the shape reference point
    var yOfs = -yRef || 0;
    var drawCommands = this.segsToDrawCmds(segs, xOfs, yOfs, xScale, yScale);

    var pathObj = new Obj2D(this, drawCommands, this.objType.SHAPE, true, fillColor, strokeColor, null, drag);  // iso = true

    return pathObj;
  }

  Cango.prototype.drawPath = function(path, x, y, scl, color, isotropic)
  {
    var pathObj = this.compilePath(path, color, isotropic);
    pathObj.scale(scl);            // the Obj2D returned will rememebr its drawn size
    this.render(pathObj, x, y);
    return pathObj;
  }

  Cango.prototype.drawShape = function(path, x, y, scl, fillColor, strokeColor, isotropic)
  {
    var pathObj = this.compileShape(path, fillColor, strokeColor, isotropic);
    pathObj.scale(scl);            // the Obj2D returned will rememebr its drawn size
    this.render(pathObj, x, y);
    return pathObj;
  }

  Cango.prototype.drawText = function(str, x, y, ptSize, lorg)
  {
    var pathObj = this.compileText(str, ptSize, lorg);
    this.render(pathObj, x, y);
    return pathObj;
  }

  Cango.prototype.drawImg = function(imgURL, x, y, w, lorigin)  // just load img then calls _paintImg
  {
    var savThis = this;

    var xOfs = x || 0;
    var yOfs = y || 0;
    var lorg = lorigin || 1;
    var wid = w || 0;
    var img = new Image();
    var imgObj = new Obj2D(this, img, this.objType.IMG, true, null, null, lorg);   // iso = true for IMG

    function onloadCallback(obj, x, y, w)
    {
      return function()
              {
                var width = w || obj.drawCmds.width;    // its loaded now so width should be valid
                // only drawImg or compile image can set width, render must wait till its loaded by one of these.
                obj.width = width;   // world coords (save in object properties)
                obj.height = width*obj.drawCmds.height/obj.drawCmds.width;
                switch (lorg)
                {
                  case 1:
                    xLofs = 0;
                    yLofs = 0;
                    break;
                  case 2:
                    xLofs = 0.5*obj.width;          // work in pixels assume image already scaled
                    yLofs = 0;
                    break;
                  case 3:
                    xLofs = obj.width;
                    yLofs = 0;
                    break;
                  case 4:
                    xLofs = 0;
                    yLofs = 0.5*obj.height;
                    break;
                  case 5:
                    xLofs = 0.5*obj.width;
                    yLofs = 0.5*obj.height;
                    break;
                  case 6:
                    xLofs = obj.width;
                    yLofs = 0.5*obj.height;
                    break;
                  case 7:
                    xLofs = 0;
                    yLofs = obj.height;
                    break;
                  case 8:
                    xLofs = 0.5*obj.width;
                    yLofs = obj.height;
                    break;
                  case 9:
                    xLofs = obj.width;
                    yLofs = obj.height;
                    break;
                  default:
                    xLofs = 0;
                    yLofs = 0;
                }
                obj.imgX = -xLofs;     // world coords offset to drawing origin
                obj.imgY = -yLofs;
                // now render the image, scale is set by width value (in world coords), 0 degs rotation
                // must use _paitImg not render to get the correct rotA, rotX, rotY values
                savThis._paintImg(obj, x, y, 1, 1, 0);  // scl = 1, degs = 0
              }
    }

    imgObj.drawCmds.src = "";
    // don't render image until dimensions are know (for scaling etc)
    addLoadEvent(imgObj.drawCmds, onloadCallback(imgObj, xOfs, yOfs, wid));
    // start to load the image
    imgObj.drawCmds.src = imgURL;

    return imgObj;
  }

  Cango.prototype.animate = function(obj, xValues, yValues, sclValues, rotValues, delay, dur, repeat)
  {
    var savThis = this;
    var loop = false;
    if ((typeof repeat != 'undefined')&&(repeat == 'loop'))
      loop = true;
    var tmr;
    function doSetTimeout(obj, x, y, scl, ang, time, interval, loop)
    {
      function setRepeat()
      {
        tmr = setInterval(function(){
                                savThis.clearCanvas();
                                savThis.render(obj, x, y, scl, ang);
                              }, interval);
        savThis.intTimer.push(tmr);          // save the timer reference for animStop
        savThis.clearCanvas();
        savThis.render(obj, x, y, scl, ang);
      }

      if (loop)
      {
        tmr = setTimeout(setRepeat, time);
        savThis.timer.push(tmr);            // save the timer reference for animStop
      }
      else
      {
        tmr = setTimeout(function(){
                               savThis.clearCanvas();
                               savThis.render(obj, x, y, scl, ang);
                             }, time);
        savThis.timer.push(tmr);           // save the timer reference for animStop
      }
    }
  	var i, fc, x, dx, y, dy, scl, dScl, ang, dAng;
    var segDur, segStart;
    var t, from, to;
  	var dt = this.tickInt;	// default is 50msec
    var numTicks = Math.round(dur/dt);
    dt = dur/numTicks;    // now we will end on the final value with even intervale ticks
    var frames = new Array(numTicks+1);
    // fill in the frame times and default null values
    for (fc=0; fc<frames.length; fc++)
    {
      frames[fc] = {};             // frames is an array of objects
      frames[fc].time = fc*dt;
      frames[fc].x = 0;
      frames[fc].y = 0;
      frames[fc].ang = 0;
      frames[fc].scl = 1;
    }

    if ((typeof xValues != 'undefined')&&(xValues != null)&&(xValues instanceof Array))
    {
      // step through the X values
    	segDur = dur/(xValues.length-1);  // duration is divided into equal segments
      // step through the xValues' segments
      segStart = 0;
      fc = 0;
      t = frames[0].time;
    	for(i=1; i<xValues.length; i++, segStart+=segDur)
    	{
        from = xValues[i-1];
        to = xValues[i];
        while (t<=segStart+segDur)
  			{
          frames[fc].x = xValues[i-1]+(t-segStart)*(to-from)/segDur;     // create new property, do interpolation
          fc++;
          t = dt*fc;
  			}
    	}
    }
    else if ((typeof xValues != 'undefined')&&(xValues != null))  // single value (not animated)
    {
      for (fc=0; fc<frames.length; fc++)
      {
        frames[fc].x = xValues;
      }
    }
    if ((typeof yValues != 'undefined')&&(yValues != null)&&(yValues instanceof Array))
    {
      // step through the Y values
    	segDur = dur/(yValues.length-1);  // duration is divided into equal segments
      // step through the yValues' segments
      segStart = 0;
      fc = 0;
      t = frames[0].time;
    	for(i=1; i<yValues.length; i++, segStart+=segDur)
    	{
        from = yValues[i-1];
        to = yValues[i];
        while (t<=segStart+segDur)
  			{
          frames[fc].y = yValues[i-1]+(t-segStart)*(to-from)/segDur;     // create new property, do interpolation
          fc++;
          t = dt*fc;
  			}
    	}
    }
    else if ((typeof yValues != 'undefined')&&(yValues != null))  // single value (not animated)
    {
      for (fc=0; fc<frames.length; fc++)
      {
        frames[fc].y = yValues;
      }
    }
    // step through the rotValues
    if ((typeof rotValues != 'undefined')&&(rotValues != null)&&(rotValues instanceof Array))
    {
  	  segDur = dur/(rotValues.length-1);  // duration is divided into equal segments
      // step through the rotation variable's segments
      segStart = 0;
      fc = 0;
      t = frames[0].time;
    	for(i=1; i<rotValues.length; i++, segStart+=segDur)
    	{
        from = rotValues[i-1];
        to = rotValues[i];
        while (t<=segStart+segDur)
  			{
          frames[fc].ang = rotValues[i-1]+(t-segStart)*(to-from)/segDur;     // create new property, do interpolation
          fc++;
          t = dt*fc;
  			}
    	}
    }
    else if ((typeof rotValues != 'undefined')&&(rotValues != null))  // single value (not animated)
    {
      for (fc=0; fc<frames.length; fc++)
      {
        frames[fc].ang = rotValues;
      }
    }
    // step through the sclValues
    if ((typeof sclValues != 'undefined')&&(sclValues != null)&&(sclValues instanceof Array))
    {
  	  segDur = dur/(sclValues.length-1);  // duration is divided into equal segments
      // step through the rotation variable's segments
      segStart = 0;
      fc = 0;
      t = frames[0].time;
    	for(i=1; i<sclValues.length; i++, segStart+=segDur)
    	{
        from = sclValues[i-1];
        to = sclValues[i];
        while (t<=segStart+segDur)
  			{
          frames[fc].scl = sclValues[i-1]+(t-segStart)*(to-from)/segDur;     // create new property, do interpolation
          fc++;
          t = dt*fc;
  			}
    	}
    }
    else if ((typeof sclValues != 'undefined')&&(sclValues != null))  // single value (not animated)
    {
      for (fc=0; fc<frames.length; fc++)
      {
        frames[fc].scl = sclValues;
      }
    }
    // finally go and set the timeouts
    for (fc=0; fc<frames.length; fc++)
    {
      doSetTimeout(obj, frames[fc].x, frames[fc].y, frames[fc].scl, frames[fc].ang, delay+frames[fc].time, delay+dur, loop);
    }
  }

  Cango.prototype.stopAnimation = function()
  {
    for (var i=0, max = this.timer.length; i<max; i++)
    {
      clearTimeout(this.timer[i]);
    }
    for (var i=0, max = this.intTimer.length; i<max; i++)
    {
      clearTimeout(this.intTimer[i]);
    }
    this.timer = [];
    this.intTimer = [];
  }

  Cango.prototype.segsToDrawCmds = function (segs, xRef, yRef, xScl, yScl)
  {
    var x = 0;
    var y = 0;
    var px, py;
    var c1x, c1y;
    var rot, rx, ry, larc, swp;
    var arc_segs;
    var cmd, pc;
    var cmdObj;
    var seg, coords;
    var commands = [];
    var xScale = xScl || 1;
    var yScale = yScl || 1;
    var xOfs = xRef || 0;                 // move the shape reference point
    var yOfs = yRef || 0;

    for (var i=0; i<segs.length; i++)
    {
      seg = segs[i];
      cmd = seg[0];
      if ((i==0)&&(cmd != 'M'))   // check that the first move is absolute
        cmd = 'M';
      coords = seg.slice(1);      // skip the command copy coords
      if (coords)
        coords = coords.map(parseFloat);
      switch(cmd)
      {
        case 'M':
          x = xOfs + xScale*coords[0];
          y = yOfs + yScale*coords[1];
          px = py = null;
          cmdObj = new DrawCmd('moveTo', [x, y]);
          commands.push(cmdObj);
          coords.splice(0, 2);      // delete the 2 coords from the front of the array
          while (coords.length>0)
          {
            x = xOfs + xScale*coords[0];                // eqiv to muliple 'L' calls
            y = yOfs + yScale*coords[1];
            cmdObj = new DrawCmd('lineTo', [x, y]); // any coord pair after first move is regarded as line
            commands.push(cmdObj);
            coords.splice(0, 2);
          }
          break
        case 'm':
          x += xScale*coords[0];
          y += yScale*coords[1];
          px = py = null;
          cmdObj = new DrawCmd('moveTo', [x, y]);
          commands.push(cmdObj);
          coords.splice(0, 2);      // delete the 2 coords from the front of the array
          while (coords.length>0)
          {
            x += xScale*coords[0];                     // eqiv to muliple 'l' calls
            y += yScale*coords[1];
            cmdObj = new DrawCmd('lineTo', [x, y]); // any coord pair after first move is regarded as line
            commands.push(cmdObj);
            coords.splice(0, 2);
          }
          break

        case 'L':
          while (coords.length>0)
          {
            x = xOfs + xScale*coords[0];
            y = yOfs + yScale*coords[1];
            cmdObj = new DrawCmd('lineTo', [x, y]);
            commands.push(cmdObj);
            coords.splice(0, 2);
          }
          px = py = null;
          break
        case 'l':
          while (coords.length>0)
          {
            x += xScale*coords[0];
            y += yScale*coords[1];
            cmdObj = new DrawCmd('lineTo', [x, y]);
            commands.push(cmdObj);
            coords.splice(0, 2);
          }
          px = py = null
          break
        case 'H':
          x = xOfs + xScale*coords[0];
          px = py = null ;
          cmdObj = new DrawCmd('lineTo', [x, y]);
          commands.push(cmdObj);
          break
        case 'h':
          x += xScale*coords[0];
          px = py = null ;
          cmdObj = new DrawCmd('lineTo', [x, y]);
          commands.push(cmdObj);
          break
        case 'V':
          y = yOfs + yScale*coords[0];
          px = py = null;
          cmdObj = new DrawCmd('lineTo', [x, y]);
          commands.push(cmdObj);
          break
        case 'v':
          y += yScale*coords[0];
          px = py = null;
          cmdObj = new DrawCmd('lineTo', [x, y]);
          commands.push(cmdObj);
          break
        case 'C':
          while (coords.length>0)
          {
            c1x = xOfs + xScale*coords[0];
            c1y = yOfs + yScale*coords[1];
            px = xOfs + xScale*coords[2];
            py = yOfs + yScale*coords[3];
            x = xOfs + xScale*coords[4];
            y = yOfs + yScale*coords[5];
            cmdObj = new DrawCmd('bezierCurveTo', [c1x, c1y, px, py, x, y]);
            commands.push(cmdObj);
            coords.splice(0, 6);
          }
          break
        case 'c':
          while (coords.length>0)
          {
            c1x = x + xScale*coords[0];
            c1y = y + yScale*coords[1];
            px = x + xScale*coords[2];
            py = y + yScale*coords[3];
            x += xScale*coords[4];
            y += yScale*coords[5];
            cmdObj = new DrawCmd('bezierCurveTo', [c1x, c1y, px, py, x, y]);
            commands.push(cmdObj);
            coords.splice(0, 6);
          }
          break
        case 'S':
          if (px == null || !pc.match(/[sc]/i))
          {
            px = x;                // already absolute coords
            py = y;
          }
          cmdObj = new DrawCmd('bezierCurveTo', [x-(px-x), y-(py-y),
                                                    xOfs + xScale*coords[0], yOfs + yScale*coords[1],
                                                    xOfs + xScale*coords[2], yOfs + yScale*coords[3]]);
          commands.push(cmdObj);
          px = xOfs + xScale*coords[0];
          py = yOfs + yScale*coords[1];
          x = xOfs + xScale*coords[2];
          y = yOfs + yScale*coords[3];
          break
        case 's':
          if (px == null || !pc.match(/[sc]/i))
          {
            px = x;
            py = y;
          }
          cmdObj = new DrawCmd('bezierCurveTo', [x-(px-x), y-(py-y),
                                                    xOfs + xScale*coords[0], yOfs + yScale*coords[1],
                                                    xOfs + xScale*coords[2], yOfs + yScale*coords[3]]);
          commands.push(cmdObj);
          px = x + xScale*coords[0];
          py = y + yScale*coords[1];
          x += xScale*coords[2];
          y += yScale*coords[3];
          break
        case 'Q':
          px = xOfs + xScale*coords[0];
          py = yOfs + yScale*coords[1];
          x = xOfs + xScale*coords[2];
          y = yOfs + yScale*coords[3];
          cmdObj = new DrawCmd('quadraticCurveTo', [px, py, x, y]);
          commands.push(cmdObj);
          break
        case 'q':
          cmdObj = new DrawCmd('quadraticCurveTo', [x + xScale*coords[0], y + yScale*coords[1],
                                                       x + xScale*coords[2], y + yScale*coords[3]]);
          commands.push(cmdObj);
          px = x + xScale*coords[0];
          py = y + yScale*coords[1];
          x += xScale*coords[2];
          y += yScale*coords[3];
          break
        case 'T':
          if (px == null || !pc.match(/[qt]/i))
          {
            px = x;
            py = y;
          }
          else
          {
            px = x-(px-x);
            py = y-(py-y);
          }
          cmdObj = new DrawCmd('quadraticCurveTo', [px, py,
                                                        xOfs + xScale*coords[0], yOfs + yScale*coords[1]]);
          commands.push(cmdObj);
          px = x-(px-x);
          py = y-(py-y);
          x = xOfs + xScale*coords[0];
          y = yOfs + yScale*coords[1];
          break
        case 't':
          if (px == null || !pc.match(/[qt]/i))
          {
            px = x;
            py = y;
          }
          else
          {
            px = x-(px-x);
            py = y-(py-y);
          }
          cmdObj = new DrawCmd('quadraticCurveTo', [px, py,
                                                        x + xScale*coords[0], y + yScale*coords[1]]);
          commands.push(cmdObj);
          x += xScale*coords[0];
          y += yScale*coords[1];
          break
        case 'A':
          while (coords.length>0)
          {
            px = x;
            py = y;
            rx = xScale*coords[0];
            ry = xScale*coords[1];
            rot = -coords[2];          // rotationX: swap for CCW +ve
            larc = coords[3];          // large arc    should be ok
            swp = 1 - coords[4];       // sweep: swap for CCW +ve
            x = xOfs + xScale*coords[5];
            y = yOfs + yScale*coords[6];
            arc_segs = this.arcToBezier(px, py, rx, ry, rot, larc, swp, x, y);
            for (var l=0; l<arc_segs.length; l++)
            {
              cmdObj = new DrawCmd('bezierCurveTo', arc_segs[l]);
              commands.push(cmdObj);
            }
            coords.splice(0, 7);
          }
          break
        case 'a':
          while (coords.length>0)
          {
            px = x;
            py = y;
            rx = xScale*coords[0];
            ry = xScale*coords[1];
            rot = -coords[2];          // rotationX: swap for CCW +ve
            larc = coords[3];          // large arc    should be ok
            swp = 1 - coords[4];       // sweep: swap for CCW +ve
            x += xScale*coords[5];
            y += yScale*coords[6];
            arc_segs = this.arcToBezier(px, py, rx, ry, rot, larc, swp, x, y);
            for (var l=0; l<arc_segs.length; l++)
            {
              cmdObj = new DrawCmd('bezierCurveTo', arc_segs[l]);
              commands.push(cmdObj);
            }
            coords.splice(0, 7);
          }
          break
        case 'Z':
          cmdObj = new DrawCmd('closePath', []);
          commands.push(cmdObj);
          break
        case 'z':
          cmdObj = new DrawCmd('closePath', []);
          commands.push(cmdObj);
          break
      }
      pc = cmd     // save the previous command for possible reflected control points
    }
    return commands
  }

  Cango.prototype.arcToBezier = function(ox, oy, rx, ry, rotateX, large, sweep, x, y)
  {
    var th = rotateX * (Math.PI/180)
    var sin_th = Math.sin(th)
    var cos_th = Math.cos(th)
    rx = Math.abs(rx)
    ry = Math.abs(ry)
    var px = cos_th * (ox - x) * 0.5 + sin_th * (oy - y) * 0.5
    var py = cos_th * (oy - y) * 0.5 - sin_th * (ox - x) * 0.5
    var pl = (px*px) / (rx*rx) + (py*py) / (ry*ry)
    if (pl > 1)
    {
      pl = Math.sqrt(pl)
      rx *= pl
      ry *= pl
    }
    var a00 = cos_th / rx
    var a01 = sin_th / rx
    var a10 = (-sin_th) / ry
    var a11 = (cos_th) / ry
    var x0 = a00 * ox + a01 * oy
    var y0 = a10 * ox + a11 * oy
    var x1 = a00 * x + a01 * y
    var y1 = a10 * x + a11 * y
    var d = (x1-x0) * (x1-x0) + (y1-y0) * (y1-y0)
    var sfactor_sq = 1 / d - 0.25
    if (sfactor_sq < 0)
      sfactor_sq = 0
    var sfactor = Math.sqrt(sfactor_sq)
    if (sweep == large)
      sfactor = -sfactor
    var xc = 0.5 * (x0 + x1) - sfactor * (y1-y0)
    var yc = 0.5 * (y0 + y1) + sfactor * (x1-x0)

    var th0 = Math.atan2(y0-yc, x0-xc)
    var th1 = Math.atan2(y1-yc, x1-xc)

    var th_arc = th1-th0
    if (th_arc < 0 && sweep == 1)
    {
      th_arc += 2*Math.PI
    }
    else if (th_arc > 0 && sweep == 0)
    {
      th_arc -= 2 * Math.PI
    }
    var segments = Math.ceil(Math.abs(th_arc / (Math.PI * 0.5 + 0.001)))
    var result = []
    for (var i=0; i<segments; i++)
    {
      var th2 = th0 + i * th_arc / segments
      var th3 = th0 + (i+1) * th_arc / segments
      result.push(this.segmentToBezier(xc, yc, th2, th3, rx, ry, sin_th, cos_th));
    }

    return result
  }

  Cango.prototype.segmentToBezier = function(cx, cy, th0, th1, rx, ry, sin_th, cos_th)
  {
    var a00 = cos_th * rx
    var a01 = -sin_th * ry
    var a10 = sin_th * rx
    var a11 = cos_th * ry

    var th_half = 0.5 * (th1 - th0)
    var t = (8/3) * Math.sin(th_half * 0.5) * Math.sin(th_half * 0.5) / Math.sin(th_half)
    var x1 = cx + Math.cos(th0) - t * Math.sin(th0)
    var y1 = cy + Math.sin(th0) + t * Math.cos(th0)
    var x3 = cx + Math.cos(th1)
    var y3 = cy + Math.sin(th1)
    var x2 = x3 + t * Math.sin(th1)
    var y2 = y3 - t * Math.cos(th1)
    return [
              a00 * x1 + a01 * y1, a10 * x1 + a11 * y1,
              a00 * x2 + a01 * y2, a10 * x2 + a11 * y2,
              a00 * x3 + a01 * y3, a10 * x3 + a11 * y3
            ]
  }

  if (!Array.prototype.map)
  {
    Array.prototype.map = function(fun)
    {
      var len = this.length;
      if (typeof fun != "function")
        throw new TypeError();
      var res = new Array(len);
      var thisp = arguments[1];
      for (var i = 0; i < len; i++)
      {
        if (i in this)
          res[i] = fun.call(thisp, this[i], i, this);
      }
      return res;
    };
  }

  // copy the basic graphics context values (for an overlay)
  Cango.prototype.dupCtx = function(src_graphCtx)
  {
    // copy all the graphics context parameters into the overlay ctx.
    this.vpLLx = src_graphCtx.vpLLx;      // vp lower left from canvas left in pixels
    this.vpLLy = src_graphCtx.vpLLy;      // vp lower left from canvas top
    this.xscl = src_graphCtx.xscl;        // world x axis scale factor
    this.yscl = src_graphCtx.yscl;        // world y axis scale factor
    this.xoffset = src_graphCtx.xoffset;  // world x origin offset from viewport left in pixels
    this.yoffset = src_graphCtx.yoffset;  // world y origin offset from viewport bottom in pixels
    this.penCol = src_graphCtx.penCol.slice(0);   // copy value not reference
    this.penWid = src_graphCtx.penWid;    // pixels
    this.lineCap = src_graphCtx.lineCap.slice(0);
    this.paintCol = src_graphCtx.paintCol.slice(0);
    this.fontSize = src_graphCtx.fontSize;
    this.fontWeight = src_graphCtx.fontWeight;
    this.tickInt = src_graphCtx.tickInt;
  }

  function Obj2D(cgo, commands, objtype, isotropic, fillColor, strokeColor, lorg, dragObj)
  {
    this.drawCmds = commands;      // array of DrawCmd objects holding cmds and world coords (or an Img object)
    this.pxOutline = [];           // array of DrawCmd objects holding 'as rendered' cmds and pixel coords
    this.pxOrgX = 0;               // pixels coords of the 'as rendered' drawing origin
    this.pxOrgY = 0;               //     "
    this.type = 1;                 // enum of type to instruct the render method
    this.iso = false;              // true = maintain aspect ratio
    this.strokeCol = "black";      // renderer will stroke a path in this color
    this.fillCol = "gray";         // only used if type = SHAPE
    this.strokeWidth = 1;          // freeze current penWid in case fat outline is wanted
    this.strokeCap = "butt";       // freeze current style in case something fancy is wanted
    this.width = 0;                // only used for type = IMG, TEXT, set to 0 until image loaded
    this.height = 0;               //     "
    this.imgX = 0;                 // TEXT & IMG use these for obj.translate, obj.rotate, obj.scale
    this.imgY = 0;                 //     "
    this.imgXscale = 1;            //     "
    this.imgYscale = 1;            //     "
    this.imgDegs = 0;              //     "
    this.lorg = lorg || 1;         // only used for type = IMG and TEXT
    this.dragNdrop = dragObj || null;

    // step 5 add __getattr__ function to Obj2D object (20130111 起必須放到物件中)
    this.__getattr__ = function(attr){return $getattr(this,attr)}

    if ((typeof cgo != 'undefined')&&(cgo != null))
    {
      if (typeof objtype != "undefined")
        this.type = objtype;
      if (typeof isotropic != "undefined")
        this.iso = isotropic;
      // check for iso error
      if ((this.type == cgo.objType.IMG)||(this.type == cgo.objType.TEXT))
        this.iso = true;

      if ((typeof fillColor != "undefined")&&(fillColor != null))
        this.fillCol = fillColor;
      else
        this.fillCol = cgo.paintCol;

      if ((typeof strokeColor != "undefined")&&(strokeColor != null))
        this.strokeCol = strokeColor;
      else if (this.type == cgo.objType.SHAPE)
        this.strokeCol = this.fillCol; // shapes default to stroke and fill the same
      else
        this.strokeCol = cgo.penCol;   // path and text default to current pen color

      this.strokeWidth = cgo.penWid;
      this.strokeCap = cgo.lineCap;
      if (this.type == cgo.objType.TEXT)
      {
        this.strokeWidth = 0.08*cgo.fontSize*cgo.fontWeight/400;   // default (should be set as function of pt size)
        this.strokeCap = 'round';                // text must be stroked round to look good
      }
    }
    if (this.dragNdrop != null)
      this.dragNdrop.parent = this;    // give dragNdrop callBacks easy access to the object
  }
  
  Obj2D.prototype.translate = function(x, y)
  {
    var cmd;
    if (this.type > 1)   // IMG or TEXT
    {
      // no points to shift just remeber the offset to use when rendering
      this.imgX += x;     // IMG and TEXT type effect translate during render
      this.imgY += y;
    }
    else
    {
      for (var i=0; i<this.drawCmds.length; i++)
      {
        cmd = this.drawCmds[i];  // for clarity
        for (var j=0; j<cmd.parms.length/2; j++)
        {
          cmd.parms[2*j] += x;
          cmd.parms[2*j+1] += y;
        }
      }
    }
  }

  Obj2D.prototype.rotate = function(degs)
  {
    var A = Math.PI*degs/180.0;   // radians
    var sinA = Math.sin(A);
    var cosA = Math.cos(A);
    var x, y;

    if (this.type > 1)   // IMG  or TEXT
    {
      // no points to shift just remember the value to use when rendering
      this.imgDegs = degs;
    }
    else
    {
      for (var i=0; i<this.drawCmds.length; i++)
      {
        cmd = this.drawCmds[i];  // for clarity
        for (var j=0; j<cmd.parms.length/2; j++)
        {
          x = cmd.parms[2*j];
          y = cmd.parms[2*j+1];
          cmd.parms[2*j] = x*cosA - y*sinA;
          cmd.parms[2*j+1] = x*sinA + y*cosA;
        }
      }
    }
  }

  Obj2D.prototype.scale = function(xScl, yScl)
  {
    var cmd;
    var xScale = xScl || 1;
    var yScale = yScl || xScale;   // default to isotropic scaling

    if (this.type > 1)   // IMG  or TEXT
    {
      // no points to shift just remeber values to use when rendering
      this.imgXscale *= xScale;
      this.imgYscale *= yScale;
      this.imgX *= xScale;
      this.imgY *= yScale;
    }
    else
    {
      for (var i=0; i<this.drawCmds.length; i++)
      {
        cmd = this.drawCmds[i];  // for clarity
        for (var j=0; j<cmd.parms.length/2; j++)
        {
          cmd.parms[2*j] *= xScale;
          cmd.parms[2*j+1] *= yScale;
        }
      }
    }
  }

  Obj2D.prototype.enableDrag = function(drag)
  {
    this.dragNdrop = drag;
    // fill in the Drag2D properties for use by callBacks
    this.dragNdrop.parent = this;
    // the Obj2D may already have been rendered, save the 'as rendered' drawing origin
    this.dragNdrop.xOrg = this.pxOrgX;
    this.dragNdrop.yOrg = this.pxOrgY;
    // include this in objects to be checked on mousedown
    // the Drag2D has the cango context saved as 'this.cgo'
    drag.cgo.draggable.push(this);
  }

  Obj2D.prototype.disableDrag = function()
  {
    function getIndex(ary, obj)
    {
      for (var i=0, j=ary.length; i<j; i++) {
        if (ary[i] === obj) { return i; }
      }
      return -1;
    }
    if (!this.dragNdrop)
      return;
    // remove this object from array to be checked on mousedown
    // the Drag2D has the cango context saved as 'this.cgo'
    var aidx = getIndex(this.dragNdrop.cgo.draggable, this);
    this.dragNdrop.cgo.draggable.splice(aidx, 1);
    this.dragNdrop = null;
  }

  Obj2D.prototype.setStrokeWidth = function(w)    // w in screen px
  {
    if ((typeof w != "undefined")&&(w>0))
      this.strokeWidth = w;
  }

  Obj2D.prototype.dup = function()
  {
    function cloneDrawCmds(orgCmds)
    {
      var newcmds = (orgCmds instanceof Array) ? [] : {};
      for (i in orgCmds)
      {
        if (orgCmds[i] && typeof orgCmds[i] == "object")
        {
          newcmds[i] = cloneDrawCmds(orgCmds[i]);
        }
        else
          newcmds[i] = orgCmds[i];
      }
      return newcmds;
    }

    var newObj = new Obj2D();

    newObj.drawCmds = cloneDrawCmds(this.drawCmds);   // might be IMG or Array
    newObj.type = this.type;
    newObj.iso = this.iso;
    newObj.strokeCol = this.strokeCol;
    newObj.fillCol = this.fillCol;
    newObj.strokeWidth = this.strokeWidth;
    newObj.strokeCap = this.strokeCap;
    newObj.width = this.width;
    newObj.height = this.height;
    newObj.imgX = this.imgX;
    newObj.imgY = this.imgY;
    newObj.imgXscale = this.imgXscale;
    newObj.imgYscale = this.imgYscale;
    newObj.imgDegs = this.imgDegs;
    newObj.lorg = this.lorg;

    return newObj;
  }

  function Drag2D(cangoGC, grabFn, dragFn, dropFn)
  {
    this.cgo = cangoGC;
    this.parent = null;
    this.grabCallback = grabFn || null;
    this.dragCallback = dragFn || null;
    this.dropCallback = dropFn || null;
    this.xOrg = 0;      // drawing origin (pxls), updated by render or enableDrag
    this.yOrg = 0;
    this.xGrabOfs = 0;  // csr offset (pxls) from origin filled in at grab time
    this.yGrabOfs = 0;

    // step 4 add __getattr__ function to Drag2D object (20130111 起必須放到物件中)
    this.__getattr__ = function(attr){return $getattr(this,attr)}

    var savThis = this;

    // these closures are called in the scope of the Drag2D instance so this is valid
    this.grab = function(e)
    {
      var e = e||window.event;
      this.cgo.cnvs.onmouseup = function(e){savThis.drop(e)};    // create a closure
      var csrPos = this.cgo.getCursorPos(e);      // update mouse pos to pass to the owner
      // save the cursor offset from the drawing origin
      this.xGrabOfs = csrPos.x - this.xOrg;
      this.yGrabOfs = csrPos.y - this.yOrg;

      if (this.grabCallback)
        this.grabCallback(csrPos);    // call in the scope of dragNdrop object

      this.cgo.cnvs.onmousemove = function(e){savThis.drag(e)};  // create a closure
      if (e.preventDefault)       // prevent default browser action (W3C)
        e.preventDefault();
      else                        // shortcut for stopping the browser action in IE
        window.event.returnValue = false;
      return false;
    };

    this.drag = function(e)
    {
      var csrPos = this.cgo.getCursorPos(e);  // update mouse pos to pass to the owner
      if (this.dragCallback)
        this.dragCallback(csrPos);
    };

    this.drop = function(e)
    {
      var csrPos = this.cgo.getCursorPos(e);  // update mouse pos to pass to the owner
      this.cgo.cnvs.onmouseup = null;
      this.cgo.cnvs.onmousemove = null;
      if (this.dropCallback)
        this.dropCallback(csrPos);
    };
  }
    // step 4 add __getattr__ function to Drag2D object (放進物件)
    //Drag2D.__getattr__ = function(attr){return getattr(this,attr)}
  
  function DrawCmd(cmdStr, coords)   // canvas syntax draw commands
  {
    this.drawFn = cmdStr;       // String version of the canvas command to call
    this.parms = coords || [];  // array of parameters to pass to drawFn
  }

  var CanvasTextFunctions = { };
  //
  // This code is released to the public domain by Jim Studt, 2007.
  // He may keep some sort of up to date copy at http://www.federated.com/~jim/canvastext/
  //

  CanvasTextFunctions.letters = {
      ' ': { width: 16, points: [] },
      '!': { width: 10, points: [[5,21],[5,7],[-1,-1],[5,2],[4,1],[5,0],[6,1],[5,2]] },
      '"': { width: 16, points: [[4,21],[4,14],[-1,-1],[12,21],[12,14]] },
      '#': { width: 21, points: [[11,25],[4,-7],[-1,-1],[17,25],[10,-7],[-1,-1],[4,12],[18,12],[-1,-1],[3,6],[17,6]] },
      '$': { width: 20, points: [[8,25],[8,-4],[-1,-1],[12,25],[12,-4],[-1,-1],[17,18],[15,20],[12,21],[8,21],[5,20],[3,18],[3,16],[4,14],[5,13],[7,12],[13,10],[15,9],[16,8],[17,6],[17,3],[15,1],[12,0],[8,0],[5,1],[3,3]] },
      '%': { width: 24, points: [[21,21],[3,0],[-1,-1],[8,21],[10,19],[10,17],[9,15],[7,14],[5,14],[3,16],[3,18],[4,20],[6,21],[8,21],[10,20],[13,19],[16,19],[19,20],[21,21],[-1,-1],[17,7],[15,6],[14,4],[14,2],[16,0],[18,0],[20,1],[21,3],[21,5],[19,7],[17,7]] },
      '&': { width: 26, points: [[23,12],[23,13],[22,14],[21,14],[20,13],[19,11],[17,6],[15,3],[13,1],[11,0],[7,0],[5,1],[4,2],[3,4],[3,6],[4,8],[5,9],[12,13],[13,14],[14,16],[14,18],[13,20],[11,21],[9,20],[8,18],[8,16],[9,13],[11,10],[16,3],[18,1],[20,0],[22,0],[23,1],[23,2]] },
      '\'': { width: 10, points: [[5,19],[4,20],[5,21],[6,20],[6,18],[5,16],[4,15]] },
      '(': { width: 14, points: [[11,25],[9,23],[7,20],[5,16],[4,11],[4,7],[5,2],[7,-2],[9,-5],[11,-7]] },
      ')': { width: 14, points: [[3,25],[5,23],[7,20],[9,16],[10,11],[10,7],[9,2],[7,-2],[5,-5],[3,-7]] },
      '*': { width: 16, points: [[8,21],[8,9],[-1,-1],[3,18],[13,12],[-1,-1],[13,18],[3,12]] },
      '+': { width: 26, points: [[13,18],[13,0],[-1,-1],[4,9],[22,9]] },
      ',': { width: 10, points: [[6,1],[5,0],[4,1],[5,2],[6,1],[6,-1],[5,-3],[4,-4]] },
      '-': { width: 26, points: [[4,9],[22,9]] },
      '.': { width: 10, points: [[5,2],[4,1],[5,0],[6,1],[5,2]] },
      '/': { width: 22, points: [[20,25],[2,-7]] },
      '0': { width: 20, points: [[9,21],[6,20],[4,17],[3,12],[3,9],[4,4],[6,1],[9,0],[11,0],[14,1],[16,4],[17,9],[17,12],[16,17],[14,20],[11,21],[9,21]] },
      '1': { width: 20, points: [[6,17],[8,18],[11,21],[11,0]] },
      '2': { width: 20, points: [[4,16],[4,17],[5,19],[6,20],[8,21],[12,21],[14,20],[15,19],[16,17],[16,15],[15,13],[13,10],[3,0],[17,0]] },
      '3': { width: 20, points: [[5,21],[16,21],[10,13],[13,13],[15,12],[16,11],[17,8],[17,6],[16,3],[14,1],[11,0],[8,0],[5,1],[4,2],[3,4]] },
      '4': { width: 20, points: [[13,21],[3,7],[18,7],[-1,-1],[13,21],[13,0]] },
      '5': { width: 20, points: [[15,21],[5,21],[4,12],[5,13],[8,14],[11,14],[14,13],[16,11],[17,8],[17,6],[16,3],[14,1],[11,0],[8,0],[5,1],[4,2],[3,4]] },
      '6': { width: 20, points: [[16,18],[15,20],[12,21],[10,21],[7,20],[5,17],[4,12],[4,7],[5,3],[7,1],[10,0],[11,0],[14,1],[16,3],[17,6],[17,7],[16,10],[14,12],[11,13],[10,13],[7,12],[5,10],[4,7]] },
      '7': { width: 20, points: [[17,21],[7,0],[-1,-1],[3,21],[17,21]] },
      '8': { width: 20, points: [[8,21],[5,20],[4,18],[4,16],[5,14],[7,13],[11,12],[14,11],[16,9],[17,7],[17,4],[16,2],[15,1],[12,0],[8,0],[5,1],[4,2],[3,4],[3,7],[4,9],[6,11],[9,12],[13,13],[15,14],[16,16],[16,18],[15,20],[12,21],[8,21]] },
      '9': { width: 20, points: [[16,14],[15,11],[13,9],[10,8],[9,8],[6,9],[4,11],[3,14],[3,15],[4,18],[6,20],[9,21],[10,21],[13,20],[15,18],[16,14],[16,9],[15,4],[13,1],[10,0],[8,0],[5,1],[4,3]] },
      ':': { width: 10, points: [[5,14],[4,13],[5,12],[6,13],[5,14],[-1,-1],[5,2],[4,1],[5,0],[6,1],[5,2]] },
      ';': { width: 10, points: [[5,14],[4,13],[5,12],[6,13],[5,14],[-1,-1],[6,1],[5,0],[4,1],[5,2],[6,1],[6,-1],[5,-3],[4,-4]] },
      '<': { width: 24, points: [[20,18],[4,9],[20,0]] },
      '=': { width: 26, points: [[4,12],[22,12],[-1,-1],[4,6],[22,6]] },
      '>': { width: 24, points: [[4,18],[20,9],[4,0]] },
      '?': { width: 18, points: [[3,16],[3,17],[4,19],[5,20],[7,21],[11,21],[13,20],[14,19],[15,17],[15,15],[14,13],[13,12],[9,10],[9,7],[-1,-1],[9,2],[8,1],[9,0],[10,1],[9,2]] },
      '@': { width: 27, points: [[18,13],[17,15],[15,16],[12,16],[10,15],[9,14],[8,11],[8,8],[9,6],[11,5],[14,5],[16,6],[17,8],[-1,-1],[12,16],[10,14],[9,11],[9,8],[10,6],[11,5],[-1,-1],[18,16],[17,8],[17,6],[19,5],[21,5],[23,7],[24,10],[24,12],[23,15],[22,17],[20,19],[18,20],[15,21],[12,21],[9,20],[7,19],[5,17],[4,15],[3,12],[3,9],[4,6],[5,4],[7,2],[9,1],[12,0],[15,0],[18,1],[20,2],[21,3],[-1,-1],[19,16],[18,8],[18,6],[19,5]] },
      'A': { width: 18, points: [[9,21],[1,0],[-1,-1],[9,21],[17,0],[-1,-1],[4,7],[14,7]] },
      'B': { width: 21, points: [[4,21],[4,0],[-1,-1],[4,21],[13,21],[16,20],[17,19],[18,17],[18,15],[17,13],[16,12],[13,11],[-1,-1],[4,11],[13,11],[16,10],[17,9],[18,7],[18,4],[17,2],[16,1],[13,0],[4,0]] },
      'C': { width: 21, points: [[18,16],[17,18],[15,20],[13,21],[9,21],[7,20],[5,18],[4,16],[3,13],[3,8],[4,5],[5,3],[7,1],[9,0],[13,0],[15,1],[17,3],[18,5]] },
      'D': { width: 21, points: [[4,21],[4,0],[-1,-1],[4,21],[11,21],[14,20],[16,18],[17,16],[18,13],[18,8],[17,5],[16,3],[14,1],[11,0],[4,0]] },
      'E': { width: 19, points: [[4,21],[4,0],[-1,-1],[4,21],[17,21],[-1,-1],[4,11],[12,11],[-1,-1],[4,0],[17,0]] },
      'F': { width: 18, points: [[4,21],[4,0],[-1,-1],[4,21],[17,21],[-1,-1],[4,11],[12,11]] },
      'G': { width: 21, points: [[18,16],[17,18],[15,20],[13,21],[9,21],[7,20],[5,18],[4,16],[3,13],[3,8],[4,5],[5,3],[7,1],[9,0],[13,0],[15,1],[17,3],[18,5],[18,8],[-1,-1],[13,8],[18,8]] },
      'H': { width: 22, points: [[4,21],[4,0],[-1,-1],[18,21],[18,0],[-1,-1],[4,11],[18,11]] },
      'I': { width: 8, points: [[4,21],[4,0]] },
      'J': { width: 16, points: [[12,21],[12,5],[11,2],[10,1],[8,0],[6,0],[4,1],[3,2],[2,5],[2,7]] },
      'K': { width: 21, points: [[4,21],[4,0],[-1,-1],[18,21],[4,7],[-1,-1],[9,12],[18,0]] },
      'L': { width: 17, points: [[4,21],[4,0],[-1,-1],[4,0],[16,0]] },
      'M': { width: 24, points: [[4,21],[4,0],[-1,-1],[4,21],[12,0],[-1,-1],[20,21],[12,0],[-1,-1],[20,21],[20,0]] },
      'N': { width: 22, points: [[4,21],[4,0],[-1,-1],[4,21],[18,0],[-1,-1],[18,21],[18,0]] },
      'O': { width: 22, points: [[9,21],[7,20],[5,18],[4,16],[3,13],[3,8],[4,5],[5,3],[7,1],[9,0],[13,0],[15,1],[17,3],[18,5],[19,8],[19,13],[18,16],[17,18],[15,20],[13,21],[9,21]] },
      'P': { width: 21, points: [[4,21],[4,0],[-1,-1],[4,21],[13,21],[16,20],[17,19],[18,17],[18,14],[17,12],[16,11],[13,10],[4,10]] },
      'Q': { width: 22, points: [[9,21],[7,20],[5,18],[4,16],[3,13],[3,8],[4,5],[5,3],[7,1],[9,0],[13,0],[15,1],[17,3],[18,5],[19,8],[19,13],[18,16],[17,18],[15,20],[13,21],[9,21],[-1,-1],[12,4],[18,-2]] },
      'R': { width: 21, points: [[4,21],[4,0],[-1,-1],[4,21],[13,21],[16,20],[17,19],[18,17],[18,15],[17,13],[16,12],[13,11],[4,11],[-1,-1],[11,11],[18,0]] },
      'S': { width: 20, points: [[17,18],[15,20],[12,21],[8,21],[5,20],[3,18],[3,16],[4,14],[5,13],[7,12],[13,10],[15,9],[16,8],[17,6],[17,3],[15,1],[12,0],[8,0],[5,1],[3,3]] },
      'T': { width: 16, points: [[8,21],[8,0],[-1,-1],[1,21],[15,21]] },
      'U': { width: 22, points: [[4,21],[4,6],[5,3],[7,1],[10,0],[12,0],[15,1],[17,3],[18,6],[18,21]] },
      'V': { width: 18, points: [[1,21],[9,0],[-1,-1],[17,21],[9,0]] },
      'W': { width: 24, points: [[2,21],[7,0],[-1,-1],[12,21],[7,0],[-1,-1],[12,21],[17,0],[-1,-1],[22,21],[17,0]] },
      'X': { width: 20, points: [[3,21],[17,0],[-1,-1],[17,21],[3,0]] },
      'Y': { width: 18, points: [[1,21],[9,11],[9,0],[-1,-1],[17,21],[9,11]] },
      'Z': { width: 20, points: [[17,21],[3,0],[-1,-1],[3,21],[17,21],[-1,-1],[3,0],[17,0]] },
      '[': { width: 14, points: [[4,25],[4,-7],[-1,-1],[5,25],[5,-7],[-1,-1],[4,25],[11,25],[-1,-1],[4,-7],[11,-7]] },
      '\\': { width: 14, points: [[0,21],[14,-3]] },
      ']': { width: 14, points: [[9,25],[9,-7],[-1,-1],[10,25],[10,-7],[-1,-1],[3,25],[10,25],[-1,-1],[3,-7],[10,-7]] },
      '^': { width: 16, points: [[6,15],[8,18],[10,15],[-1,-1],[3,12],[8,17],[13,12],[-1,-1],[8,17],[8,0]] },
      '_': { width: 16, points: [[0,-2],[16,-2]] },
      '`': { width: 10, points: [[6,21],[5,20],[4,18],[4,16],[5,15],[6,16],[5,17]] },
      'a': { width: 19, points: [[15,14],[15,0],[-1,-1],[15,11],[13,13],[11,14],[8,14],[6,13],[4,11],[3,8],[3,6],[4,3],[6,1],[8,0],[11,0],[13,1],[15,3]] },
      'b': { width: 19, points: [[4,21],[4,0],[-1,-1],[4,11],[6,13],[8,14],[11,14],[13,13],[15,11],[16,8],[16,6],[15,3],[13,1],[11,0],[8,0],[6,1],[4,3]] },
      'c': { width: 18, points: [[15,11],[13,13],[11,14],[8,14],[6,13],[4,11],[3,8],[3,6],[4,3],[6,1],[8,0],[11,0],[13,1],[15,3]] },
      'd': { width: 19, points: [[15,21],[15,0],[-1,-1],[15,11],[13,13],[11,14],[8,14],[6,13],[4,11],[3,8],[3,6],[4,3],[6,1],[8,0],[11,0],[13,1],[15,3]] },
      'e': { width: 18, points: [[3,8],[15,8],[15,10],[14,12],[13,13],[11,14],[8,14],[6,13],[4,11],[3,8],[3,6],[4,3],[6,1],[8,0],[11,0],[13,1],[15,3]] },
      'f': { width: 12, points: [[10,21],[8,21],[6,20],[5,17],[5,0],[-1,-1],[2,14],[9,14]] },
      'g': { width: 19, points: [[15,14],[15,-2],[14,-5],[13,-6],[11,-7],[8,-7],[6,-6],[-1,-1],[15,11],[13,13],[11,14],[8,14],[6,13],[4,11],[3,8],[3,6],[4,3],[6,1],[8,0],[11,0],[13,1],[15,3]] },
      'h': { width: 19, points: [[4,21],[4,0],[-1,-1],[4,10],[7,13],[9,14],[12,14],[14,13],[15,10],[15,0]] },
      'i': { width: 8, points: [[3,21],[4,20],[5,21],[4,22],[3,21],[-1,-1],[4,14],[4,0]] },
      'j': { width: 10, points: [[5,21],[6,20],[7,21],[6,22],[5,21],[-1,-1],[6,14],[6,-3],[5,-6],[3,-7],[1,-7]] },
      'k': { width: 17, points: [[4,21],[4,0],[-1,-1],[14,14],[4,4],[-1,-1],[8,8],[15,0]] },
      'l': { width: 8, points: [[4,21],[4,0]] },
      'm': { width: 30, points: [[4,14],[4,0],[-1,-1],[4,10],[7,13],[9,14],[12,14],[14,13],[15,10],[15,0],[-1,-1],[15,10],[18,13],[20,14],[23,14],[25,13],[26,10],[26,0]] },
      'n': { width: 19, points: [[4,14],[4,0],[-1,-1],[4,10],[7,13],[9,14],[12,14],[14,13],[15,10],[15,0]] },
      'o': { width: 19, points: [[8,14],[6,13],[4,11],[3,8],[3,6],[4,3],[6,1],[8,0],[11,0],[13,1],[15,3],[16,6],[16,8],[15,11],[13,13],[11,14],[8,14]] },
      'p': { width: 19, points: [[4,14],[4,-7],[-1,-1],[4,11],[6,13],[8,14],[11,14],[13,13],[15,11],[16,8],[16,6],[15,3],[13,1],[11,0],[8,0],[6,1],[4,3]] },
      'q': { width: 19, points: [[15,14],[15,-7],[-1,-1],[15,11],[13,13],[11,14],[8,14],[6,13],[4,11],[3,8],[3,6],[4,3],[6,1],[8,0],[11,0],[13,1],[15,3]] },
      'r': { width: 13, points: [[4,14],[4,0],[-1,-1],[4,8],[5,11],[7,13],[9,14],[12,14]] },
      's': { width: 17, points: [[14,11],[13,13],[10,14],[7,14],[4,13],[3,11],[4,9],[6,8],[11,7],[13,6],[14,4],[14,3],[13,1],[10,0],[7,0],[4,1],[3,3]] },
      't': { width: 12, points: [[5,21],[5,4],[6,1],[8,0],[10,0],[-1,-1],[2,14],[9,14]] },
      'u': { width: 19, points: [[4,14],[4,4],[5,1],[7,0],[10,0],[12,1],[15,4],[-1,-1],[15,14],[15,0]] },
      'v': { width: 16, points: [[2,14],[8,0],[-1,-1],[14,14],[8,0]] },
      'w': { width: 22, points: [[3,14],[7,0],[-1,-1],[11,14],[7,0],[-1,-1],[11,14],[15,0],[-1,-1],[19,14],[15,0]] },
      'x': { width: 17, points: [[3,14],[14,0],[-1,-1],[14,14],[3,0]] },
      'y': { width: 16, points: [[2,14],[8,0],[-1,-1],[14,14],[8,0],[6,-4],[4,-6],[2,-7],[1,-7]] },
      'z': { width: 17, points: [[14,14],[3,0],[-1,-1],[3,14],[14,14],[-1,-1],[3,0],[14,0]] },
      '{': { width: 14, points: [[9,25],[7,24],[6,23],[5,21],[5,19],[6,17],[7,16],[8,14],[8,12],[6,10],[-1,-1],[7,24],[6,22],[6,20],[7,18],[8,17],[9,15],[9,13],[8,11],[4,9],[8,7],[9,5],[9,3],[8,1],[7,0],[6,-2],[6,-4],[7,-6],[-1,-1],[6,8],[8,6],[8,4],[7,2],[6,1],[5,-1],[5,-3],[6,-5],[7,-6],[9,-7]] },
      '|': { width: 8, points: [[4,25],[4,-7]] },
      '}': { width: 14, points: [[5,25],[7,24],[8,23],[9,21],[9,19],[8,17],[7,16],[6,14],[6,12],[8,10],[-1,-1],[7,24],[8,22],[8,20],[7,18],[6,17],[5,15],[5,13],[6,11],[10,9],[6,7],[5,5],[5,3],[6,1],[7,0],[8,-2],[8,-4],[7,-6],[-1,-1],[8,8],[6,6],[6,4],[7,2],[8,1],[9,-1],[9,-3],[8,-5],[7,-6],[5,-7]] },
      '~': { width: 24, points: [[3,6],[3,8],[4,11],[6,12],[8,12],[10,11],[14,8],[16,7],[18,7],[20,8],[21,10],[-1,-1],[3,8],[4,10],[6,11],[8,11],[10,10],[14,7],[16,6],[18,6],[20,7],[21,10],[21,12]] }
  };

  CanvasTextFunctions.letter = function(ch)
  {
    return CanvasTextFunctions.letters[ch];
  }

  CanvasTextFunctions.ascent = function(font, size)
  {
    return size;
  }

  CanvasTextFunctions.descent = function(font, size)
  {
    return 7.0*size/25.0;
  }

  CanvasTextFunctions.measure = function(font, size, str)
  {
    var total = 0;
    var len = str.length;

    for (var i = 0; i < len; i++)
    {
    	var c = CanvasTextFunctions.letter(str.charAt(i));
    	if (c)
        total += c.width * size / 25.0;
    }

    return total;
  }

  CanvasTextFunctions.draw = function(ctx, font, size, x, y, str)
  {
    var total = 0;
    var len = str.length;
    var mag = size / 25.0;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineWidth = 2.0 * mag;

    for (var i = 0; i < len; i++)
    {
    	var c = CanvasTextFunctions.letter(str.charAt(i));
    	if (!c) continue;

    	ctx.beginPath();

    	var penUp = 1;
    	var needStroke = 0;
    	for (j = 0; j < c.points.length; j++)
      {
    	  var a = c.points[j];
    	  if (a[0] == -1 && a[1] == -1)
        {
      		penUp = 1;
      		continue;
    	  }
    	  if (penUp)
        {
      		ctx.moveTo(x + a[0]*mag, y - a[1]*mag);
      		penUp = false;
    	  }
        else
        {
    		  ctx.lineTo(x + a[0]*mag, y - a[1]*mag);
    	  }
    	}
    	ctx.stroke();
    	x += c.width*mag;
    }
    ctx.restore();
    return total;
  }

// simple add event handler that gets the handlers called in the sequene that they were set
  function addLoadEvent(obj, func)
  {
  	var oldonload = obj.onload;

  	if (typeof obj.onload != 'function')
      obj.onload = func;
  	else
    	obj.onload = function(){oldonload();	func();}
  }

  //$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$
  /*=======================================================
  Filename: CangoAxes0v09.js
  Rev 0
  By: A.R.Collins
  Description: Graph Plotting Support Utilities
  Based on c routines written for DSP work.
  License: Released into the public domain
  latest version at
  <http://www/arc.id.au/>

  Date    Description                               |By
  ------------------------------------------------------
  11Sep12 Renamed from cvxPlotUtils-02.js            ARC
  13Sep12 Converted to Cango methods                 ARC
  17Sep12 Mod to use Obj2D instead of Path2D         ARC
  18Sep12 Update to use only renderObj2D()
          Update the update to render()              ARC
  22Sep12 Update to use Cango25                      ARC
  01Oct12 Update to use Cango36                      ARC
  07Oct12 Update to use Cango38                      ARC
 =======================================================*/

  function toEngFixed(val, decPlaces)      // rounds to X dec places and no stripping of 0s
  {
    var unit = "pnum kMG";
    var man, pwr;
    var expt = 0;
    var str = "";

    if ((decPlaces==undefined)||(decPlaces<0)||(decPlaces>10))
      decPlaces = 2;
    man = 0.0;
    if (Math.abs(val)>1.0E-12)
    {
      pwr = Math.log(Math.abs(val))/(3.0*Math.LN10);
      expt = Math.floor(pwr);
      man = val/Math.pow(1000.0, expt);
      expt *= 3;
    }
    // now force round to decPlaces
    str = man.toFixed(decPlaces);
    // now add the symbol for the exponent
    return str+unit.charAt(expt/3+4);
  }

  function toEngPrec(val, sigFigs)      // rounds to X significant figures and no stripping of 0s
  {
    var unit = "pnum kMG";
    var man, pwr;
    var expt = 0;
    var str = "";
    var title = "";

    man = 0.0;
    if (Math.abs(val)>1.0E-12)
    {
      pwr = Math.log(Math.abs(val))/(3.0*Math.LN10);
      expt = Math.floor(pwr);
      man = val/Math.pow(1000.0, expt);
      expt *= 3;
    }
    str = man.toPrecision(sigFigs);
    // now add the symbol for the exponent
     return str+unit.charAt(expt/3+4);
  }

  function getMax(A)     // find the maximum value in an array
  {
    var max = A[0];

    for (var i=1; i<A.length; i++)
    {
      if (A[i]>max)
        max = A[i];
    }
    return max;
  }

  function getMin(A)
  {
    var min = A[0];

    for (var i=1; i<A.length; i++)
    {
      if (A[i]<min)
        min = A[i];
    }
    return min;
  }

  function getMaxAbs(Ar, Ai)
  {
    var max = 0;
    var temp;

    for (var i=0; i<Ar.length; i++)
    {
      temp = Math.abs(Ar[i]);
      if (temp>max)
        max = temp;
    }
    for (var i=0; i<Ai.length; i++)
    {
      temp = Math.abs(Ai[i]);
      if (temp>max)
        max = temp;
    }
    return max;
  }

  /* find first value in 2,4,8,20, ... past val
     this max may then be divided by 4 and have stepVal 1,2,5,10 ... */
  function scale248max(val)
  {
    var t = 1E-6;
    var pwr, exp, h, nxt;
    for(pwr=-6; pwr<=6; pwr+=3)
    {
      for(exp=1; exp<1000; exp*=10)
      {
        for(h=0; h<3; h++)
        {
          nxt = 2*Math.pow(2, h)*exp*Math.pow(10, pwr); // generates 2,4,8, 20 ... 800
          if ((val < 0) && (-nxt < val))
            return -t;
          t = nxt
          if ((val >= 0) && (t >= val))
            return t;
        }
      }
    }
    return t*Math.pow(10, pwr-3);
  }

  function scale125max(val)
  {
    var t = 1E-6;
    var pwr, exp, h, nxt;
    for(pwr=-6; pwr<=6; pwr+=3)
    {
      for(exp=1; exp<1000; exp*=10)
      {
        for(h=0; h<3; h++)
        {
          nxt = (h*h+1)*exp*Math.pow(10, pwr); // generates 1,2,5,10 ... 500
          if ((val < 0) && (-nxt < val))
            return -t;
          t = nxt
          if ((val >= 0) && (t >= val))
            return t;
        }
      }
    }
    return t*Math.pow(10, pwr-3);
  }

  /* find first value in 1, 2.5, 5, 10, ... past val
     this max may then be divided by 5 or 10 steps and have stepVal 1,2,5,10 ... */
  function scale125step(val)
  {
    var t = 1E-6;
    var pwr, exp, h, nxt;
    for(pwr=-6; pwr<=6; pwr+=3)
    {
      for(exp=1; exp<1000; exp*=10)
      {
        for(h=1; h<4; h++)
        {
          nxt = ((h*h+1)/2)*exp*Math.pow(10, pwr); // generates 1,2.5,5,10,25,50 ... 500
          if ((val < 0) && (-nxt < val))
            return -t;
          t = nxt
          if ((val >= 0) && (t >= val))
            return t;
        }
      }
    }
    return t*Math.pow(10, pwr-3);
  }

  function scaleLog(val)
  {
    for (var t=-200; t<=200; t+=10)
    {
      if (t>val)
        return t;
    }
    return t;
  }

  Cango.prototype.drawAxes = function(xOrg, yOrg, xMin, xMax, yMin, yMax, xMinTic, yMinTic, xMajTic, yMajTic, x10ths, y10ths)
  {
    // to get uniform tick lengths and label positions create a isotropic set of world coords where x axis is 100 units
    var isoGC = new Cango(this.cId);   // copy the canvas ID from current context
    isoGC.dupCtx(this);
    isoGC.setViewport();           // full screen in viewport coords (world coords with x axis 100 units y axis same unit)
    // draw all ticks in these world coords at positions set in current Cango context using this.toViewportCorrds().

    var x, y;
    var pos;
    var data = [];
    var dataCmds;
    var ticLen = 0.6;   // 0.6% of width of canvas
    var lblOfs = 2.5;   // 2.5% of width of canvas
  	var lorg = 1;
    var side = 1;      // 1 or -1 depending on the side of the axis to label

    // will use previously set penCol
    var tickCmds = this.compilePath(['M', -1, 0, 'L', 1, 0]);    // tick line +/- 1 unit about center reference
    var xTics = new AxisTicsManual(xMin, xMax, xMinTic, xMajTic);
    var yTics = new AxisTicsManual(yMin, yMax, yMinTic, yMajTic);

    // draw axes
    data = ['M', xMin, yOrg, 'L', xMax, yOrg, 'M', xOrg, yMin, 'L', xOrg, yMax];
    this.drawPath(data);
    // X axis tick marks
    if (xTics.ticStep)
    {
      for(x=xTics.tic1; x<=xMax; x+=xTics.ticStep)
      {
        pos = this.toViewportCoords(x, yOrg);
        isoGC.render(tickCmds, pos.x, pos.y, ticLen, 90);
      }
    }
    // Y axis tick marks
    if (yTics.ticStep)
    {
      for(y=yTics.tic1; y<=yMax; y+=yTics.ticStep)
      {
        pos = this.toViewportCoords(xOrg, y);
        isoGC.render(tickCmds, pos.x, pos.y, ticLen, 0);
      }
    }
    // major ticks X axis
    if (xTics.lblStep)
    {
      for(x=xTics.lbl1; x<=xMax; x+=xTics.lblStep)
      {
        pos = this.toViewportCoords(x, yOrg);
        isoGC.render(tickCmds, pos.x, pos.y, 2*ticLen, 90);
      }
    }
    // major ticks Y axis
    if (yTics.lblStep)
    {
      for(y=yTics.lbl1; y<=yMax; y+=yTics.lblStep)
      {
        pos = this.toViewportCoords(xOrg, y);
        isoGC.render(tickCmds, pos.x, pos.y, 2*ticLen, 0);
      }
    }
    // now label the axes
		if (xTics.lblStep)
		{
    	// X axis, decide whether to label above or below X axis
  		if (((yOrg<yMin+0.55*(yMax-yMin)) && (this.yscl<0))||((yOrg>yMin+0.45*(yMax-yMin)) && !(this.yscl<0)))
    	{   // x axis on bottom half of screen
    		side = -1;
    		lorg = 2;
    	}
    	else
    	{
    	  side = 1;
    		lorg = 8;
    	}
    	for (x = xTics.lbl1; x<=xMax; x += xTics.lblStep)
    	{
  			// skip label at the origin if it would be on the other axis
  			if ((x==xOrg)&&(yOrg>yMin)&&(yOrg<yMax))
  				continue;
        pos = this.toViewportCoords(x, yOrg);
        isoGC.drawText(engNotation(x, x10ths), pos.x, pos.y+side*lblOfs, 10, lorg);
    	}
    }

		if (yTics.lblStep)
		{
    	// Y axis, decide whether to label to right or left of Y axis
    	if (((xOrg<xMin+0.5*(xMax-xMin)) && (this.xscl>0))||((xOrg>xMin+0.5*(xMax-xMin)) && !(this.xscl>0)))
    	{  // y axis on left half of screen
    		side = -1;
    		lorg = 6;
    	}
    	else
    	{
    	  side = 1;
    		lorg = 4;
    	}
    	for (y = yTics.lbl1; y<=yMax; y += yTics.lblStep)
    	{
  			// skip label at the origin if it would be on the other axis
  			if ((y==yOrg)&&(xOrg>xMin)&&(xOrg<xMax))
  				continue;
        pos = this.toViewportCoords(xOrg, y);
        isoGC.drawText(engNotation(y, y10ths), pos.x+side*lblOfs, pos.y, 10, lorg);
    	}
    }
  }

  Cango.prototype.drawBoxAxes = function(xMin, xMax, yMin, yMax, xMn, yMn, xUnits, yUnits, title)
  {
    // to get uniform tick lengths and label positions create a isotropic set of world coords where x axis is 100 units
    var isoGC = new Cango(this.cId);   // copy the canvas ID from current context
    isoGC.dupCtx(this);            // copy penCol, rotation etc
    isoGC.setViewport();           // full screen in viewport coords (world coords with x axis 100 units y axis same unit)
    // draw all ticks in these world coords at positions set in current Cango context using this.toViewportCorrds().

		var x, y;
    var pos;
    var data = [];
    var dataCmds;
    var ticLen = 1;     // 1% of width of canvas
    var lblOfs = 1.6;   // 1.6% of width of canvas
  	var lorg = 1;
		var lbl;

    var tickCmds = this.compilePath(['M', -1, 0, 'L', 0, 0]);    // tick line 1 unit to left of reference
		var xTics = new AxisTicsManual(xMin, xMax, xMn);
		var yTics = new AxisTicsManual(yMin, yMax, yMn);

    this.setPenColor('#cccccc');
		// Draw box axes
    data = ['M', xMin, yMin, 'L', xMin, yMax, xMax, yMax, xMax, yMin, 'z'];
    this.drawPath(data);

		if (xMn == undefined)
			return;
    this.setPenColor('rgba(255,255,255,0.2)');   // 20% opacity
    isoGC.setPenColor('rgba(255,255,255,0.2)');
  	for (x=xTics.tic1; x<=xMax; x += xTics.ticStep)
  	{
      pos = this.toViewportCoords(x, yMin);
      isoGC.render(tickCmds, pos.x, pos.y, ticLen, 90);      // just draw the tick mark
      if ((x != xMin)&&(x != xMax))        // no dots on the box
        this.drawPath(['M', x, yMin, 'L', x, yMax]);
  	}
		if (yMn == undefined)
			return;
  	for (y=yTics.tic1; y<=yMax; y += yTics.ticStep)
  	{
      pos = this.toViewportCoords(xMin, y);
      isoGC.render(tickCmds, pos.x, pos.y, ticLen, 0);      // just draw the tick mark
      if ((y != yMin)&&(y != yMax))
        this.drawPath(['M', xMin, y, 'L', xMax, y]);
  	}
    this.setPenColor('#cccccc');
    isoGC.setPenColor('#cccccc');

		// Now labels, X axis, label only first and last tic below X axis
		x = xTics.tic1;
    pos = this.toViewportCoords(x, yMin);
    isoGC.drawText(engNotation(x), pos.x, pos.y - lblOfs, 10, 1);
  	while(x+xTics.ticStep <= 1.05*xMax)
  		x += xTics.ticStep;
    pos = this.toViewportCoords(x, yMin);
    isoGC.drawText(engNotation(x), pos.x, pos.y - lblOfs, 10, 3);
		// Y axis, label bottom and top tics to left of Y axis
 		y = yTics.tic1;
    pos = this.toViewportCoords(xMin, y);
    isoGC.drawText(engNotation(y), pos.x - lblOfs, pos.y, 10, 6);
  	while (y + yTics.ticStep <= 1.05*yMax)
			y += yTics.ticStep;
    pos = this.toViewportCoords(xMin, y);
    isoGC.drawText(engNotation(y), pos.x - lblOfs, pos.y, 10, 6);
    // x axis label
    if (typeof xUnits == "string")
      lbl = engNotation(xTics.ticStep)+xUnits+"/div";
    else
      lbl = engNotation(xTics.ticStep)+"/div";
    x = xMin+(xMax-xMin)/2
    pos = this.toViewportCoords(x, yMin);
    isoGC.drawText(lbl, pos.x, pos.y - lblOfs, 10, 2);
    // y axis label
    if (typeof yUnits == "string")
      lbl = engNotation(yTics.ticStep)+yUnits;
    else
      lbl = engNotation(yTics.ticStep);
    y = yMin+(yMax-yMin)/2;
    pos = this.toViewportCoords(xMin, y);
    isoGC.drawText(lbl, pos.x - lblOfs, pos.y, 10, 9);
    y = yMin+(yMax-yMin)/2.15;
    pos = this.toViewportCoords(xMin, y);
    isoGC.drawText("/div", pos.x - lblOfs, pos.y, 10, 3);
    // title
    if (typeof title == "string")
    {
      pos = this.toViewportCoords(xMin, yMax);
      isoGC.drawText(title, pos.x, pos.y + lblOfs, 10, 7);
    }
	}

  Cango.prototype.drawXYAxes = function(xOrg, yOrg, xMin, xMax, yMin, yMax, xUnits, yUnits, xLabel, yLabel)
  {
    // to get uniform tick lengths and label positions create a isotropic set of world coords where x axis is 100 units
    var isoGC = new Cango(this.cId);   // copy the canvas ID from current context
    isoGC.dupCtx(this);
    isoGC.setViewport();           // full screen in viewport coords (world coords with x axis 100 units y axis same unit)
    // draw all ticks in these world coords at positions set in current Cango context using this.toViewportCorrds().

    var pos;
    var data = [];
    var dataCmds;
    var xOfs = 6;
    var yOfs = 9;
  	var lorg = 1;
    var side = 1;      // 1 or -1 depending on the side of the axis to label

    var xTics = new AxisTicsAuto(xMin, xMax);
    var yTics = new AxisTicsAuto(yMin, yMax);

    this.drawAxes(xOrg, yOrg, xMin, xMax, yMin, yMax, xTics.ticStep, yTics.ticStep, 2*xTics.ticStep, 2*yTics.ticStep);
    var xU = "";
    var yU = "";
    if ((xUnits != undefined)&&(xUnits.length>0))
      xU = "("+xUnits+")";
    if ((yUnits != undefined)&&(yUnits.length>0))
      yU = "("+yUnits+")";

    var xL = "";
    if ((xLabel != undefined)&&(xLabel.length>0))
      xL = xLabel;
    if (((yOrg<yMin+0.55*(yMax-yMin)) && (this.yscl<0))||((yOrg>yMin+0.45*(yMax-yMin)) && !(this.yscl<0)))
    {
      side = -1;
      lorg = (this.xscl>0)? 3: 1;
    }
    else
    {
      side = 1;
      lorg = (this.xscl>0)? 9: 7;
    }
    pos = this.toViewportCoords(xMax, yOrg);
    dataCmds = isoGC.compileText(xL+xU, 13, lorg);
    isoGC.render(dataCmds, pos.x, pos.y + side*xOfs);
//    isoGC.drawText(xL+xU, pos.x, pos.y + side*xOfs, 13, lorg);

    var yL = "";
    if ((yLabel != undefined)&&(yLabel.length>0))
      yL = yLabel;
  	// Y axis, decide whether to label to right or left of Y axis
  	if (((xOrg<xMin+0.5*(xMax-xMin)) && (this.xscl>0))||((xOrg>xMin+0.5*(xMax-xMin)) && !(this.xscl>0)))
  	{
  		// y axis on left half of screen
  		side = -1;
      lorg = (this.yscl<0)? 9: 7;
  	}
  	else
  	{
  	  side = 1;
      lorg = (this.yscl<0)? 3: 1;
  	}
    pos = this.toViewportCoords(xOrg, yMax);
    dataCmds = isoGC.compileText(yL+yU, 13, lorg);
    isoGC.render(dataCmds, pos.x + side*yOfs, pos.y, 1, 90);
  }

  function AxisTicsManual(xmin, xmax,	xMn, xMj)
	{
    this.tic1 = 0;
    this.ticStep = 0;
    this.lbl1 = 0;
    this.lblStep = 0;
    this.ticScl = 0;     // reserved for future use

		if ((xmin==undefined)||(xmax==undefined)||(xMn==undefined))
			return;

		var dx;		// tolerance for avoiding maths noise

		if (xMn!=0)
		{
			dx = 0.01*xMn;
			this.tic1 = xMn*Math.ceil((xmin-dx)/xMn);
      this.ticStep = xMn;
		}

		if ((xMj!=undefined)&&(xMj>0))
		{
			this.lblStep = this.ticStep*Math.round(xMj/xMn);
			dx = 0.01*xMn;
			this.lbl1 = this.lblStep*Math.ceil((xmin-dx)/this.lblStep);
		}
    // OPTION:
    // to make all labels have same scale factor, calc lastTic and corresponding tag "m kMG" etc
    // calc engnotation for xTic1 exp=xTicScl, tag=xTicTag
    // plot x = xtic1 + n*xTicStep
    // label x/xTicScl+xTicTag
	}

  function AxisTicsAuto(min, max, numTics)   // optional 'numTics' forces the value of numSteps
  {
    this.tic1;
    this.ticStep;
    this.lbl1 = 0;
    this.lblStep = 0;
    this.ticScl = 0;     // reserved for future use

    if (numTics>1)
      this.calcNTics(min, max, numTics);
    else  // auto tick the axis
      this.calcTics(min, max);
  }

/* calcTics(min, max)
 * Calculate the tic mark spacing for graph plotting
 * Given the minimum and maximum values of the axis
 * returns the first, last tic values, the tic spacing and number
 * of ticks.
 * The algorithm gives tic spacing of 1, 2, 5, 10, 20 etc
 * and a number of ticks from ~5 to ~11
 */
  AxisTicsAuto.prototype.calcTics = function(mn, mx)
  {
    var pwr, spanman, stepman;
    var spanexp, stepexp;

    if (mn>=mx)
    {
      alert("Max must be greater than Min!");
      return;
    }
    pwr = Math.log(mx-mn)/Math.LN10;
    if (pwr<0.0)
      spanexp = Math.floor(pwr) - 1;
    else
      spanexp = Math.floor(pwr);
    spanman = (mx-mn)/Math.pow(10.0, spanexp);
    if(spanman>=5.5)
    {
      spanexp += 1;
      spanman /= 10.0;
    }
    stepman = 0.5;
    if(spanman<2.2)
      stepman = 0.2;
    if(spanman<1.1)
      stepman = 0.1;
    stepexp = 3*Math.floor(spanexp/3);
    if((spanexp<0)&&(spanexp%3!=0))
      stepexp -= 3;
    stepman = stepman*Math.pow(10.0, (spanexp-stepexp));
    this.ticStep = stepman*Math.pow(10.0, stepexp);
    if(mn>=0.0)
      this.tic1 = (Math.floor((mn/this.ticStep)-0.01)+1)*this.ticStep;   // avoid math noise
    else
      this.tic1 = -Math.floor((-mn/this.ticStep)+0.01)*this.ticStep;   // avoid math noise

/*    var str = "";
    str += "tic1= "+this.tic1+ "\n";
    str += "lastTic= "+this.lastTic+ "\n";
    str += "ticStep= "+this.ticStep+ "\n";
    str += "numSteps= "+this.numSteps;
    alert(str);
*/
  }

  AxisTicsAuto.prototype.calcNTics = function(mn, mx, n)
  {
    if (mn>=mx)
    {
      alert("Max must be greater than Min!");
      return;
    }

    this.tic1 = mn;
    this.ticStep = (mx-mn)/n;
//    this.lastTic = mx;
//    this.numSteps = n+1;         // n steps, n+1 ticks

/*    var str = "";
    str += "ymin="+mn+"  ymax="+mx+"\n";
    str += "tic1= "+this.tic1+ "\n";
    str += "lastTic= "+this.lastTic+ "\n";
    str += "ticStep= "+this.ticStep+ "\n";
    str += "numSteps= "+this.numSteps;
    alert(str);
*/
  }

  function engNotation(val, tenthsOK)        // rounds to 2 dec places and strips trailing 0s
  {
    var unit = "pnum kMG";
    var man, pwr;
    var expt = 0;
    var str = "";

    man = 0.0;
    if (Math.abs(val)>1.0E-12)
    {
      if (tenthsOK)
        pwr = Math.log(Math.abs(10*val))/(3.0*Math.LN10); // calc exp on 10 x val allows .9 not 900m
      else
        pwr = Math.log(Math.abs(val))/(3.0*Math.LN10);
      expt = Math.floor(pwr);
      man = val/Math.pow(1000.0, expt);
      expt *= 3;
    }
    // now force round to decPlaces
    str = man.toFixed(2);
    // now strip trailing 0s
    while (str.charAt(str.length-1)=='0')
      str = str.substring(0,str.length-1);
    if (str.charAt(str.length-1)=='.')
      str = str.substring(0,str.length-1);
    // now add the symbol for the exponent
    if (expt)
      return str+unit.charAt(expt/3+4);
    else
      return str;                   // dont add unnecessary space
  }
  //$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$
  // 以下再疊上 stack 相關程式庫
/*=============================================================
  Filename: canvasStack1v01.js
  Rev: 1
  By: A.R.Collins
  Description: A set of utilities create canvas elements able
  to have multiple transparent canvas layers.
  License: Released into the public domain
  latest version at
  <http://www/arc.id.au/CanvasLayers.html>
  Requires:
  - for IE, the canvas emulator 'excanvas-modified.js' from
  <http://groups.google.com/group/google-excanvas/files>.

  Date   |Description                                      |By
  -------------------------------------------------------------
  30Oct09 Rev 1.00 First release                            ARC
  08Sep12 bugfix: test for emulator failed in IE9           ARC
  ============================================================= */

  function CanvasStack(holderID, bkgColor)
  {
    // test if excanvas emulator is being used
    this.excanvas = (typeof G_vmlCanvasManager != 'undefined');

    this.overlays = new Array();  // an array of layer ids
    this.ovlyNumber = 0;           // counter to generate unique IDs

    this.holderID = holderID;
    this.holderNode = document.getElementById(this.holderID);

    if (this.holderNode.style.position == 'static')
      this.holderNode.style.position = "relative"; // for parenting canvases

    this.bkgCvs = document.createElement('canvas');
    this.bkgCvsId = this.holderID+"_bkg";
    this.bkgCvs.setAttribute('id', this.bkgCvsId);
    this.bkgCvs.setAttribute('width', this.holderNode.offsetWidth);
    this.bkgCvs.setAttribute('height', this.holderNode.offsetHeight);
    this.bkgCvs.style.backgroundColor = "transparent";
    if (bkgColor != undefined)
      this.bkgCvs.style.backgroundColor = bkgColor;
    this.bkgCvs.style.position = "absolute";
    this.bkgCvs.style.left = "0px";
    this.bkgCvs.style.top = "0px";

    this.holderNode.appendChild(this.bkgCvs);

    // now make sure this dynamic canvas is recognised by the excanvas emulator
    if (this.excanvas)
      G_vmlCanvasManager.initElement(this.bkgCvs);
  }

  CanvasStack.prototype.getBackgroundCanvasId = function()
  {
    return this.bkgCvsId;
  }

  CanvasStack.prototype.createLayer = function()
  {
    var newCvs = document.createElement('canvas');
    var ovlId = this.holderID+"_ovl_"+this.ovlyNumber;

    this.ovlyNumber++;   // increment the count to make unique ids
    newCvs.setAttribute('id', ovlId);
    newCvs.setAttribute('width', this.holderNode.offsetWidth);
    newCvs.setAttribute('height', this.holderNode.offsetHeight);
    newCvs.style.backgroundColor = "transparent";
    newCvs.style.position = "absolute";
    newCvs.style.left = "0px";
    newCvs.style.top = "0px";

    this.holderNode.appendChild(newCvs);

    // now make sure this dynamic canvas is recognised by the excanvas emulator
    if (this.excanvas)
      G_vmlCanvasManager.initElement(newCvs);

    // save the ID in a global array to facilitate removal
    this.overlays.push(ovlId);

    return ovlId;    // return the new canavs id for call to getGraphicsContext
  }

  CanvasStack.prototype.deleteLayer = function(ovlyId)
  {
    var idx = -1;
    for (var i=0; i<this.overlays.length; i++)
    {
      if (this.overlays[i] == ovlyId)
        idx = i;
    }
    if (idx == -1)
    {
      alert("overlay not found");
      return;
    }
    var ovlNode = document.getElementById(ovlyId);
    if (!ovlNode)       // there is a id stored but no actual canvas
    {
      alert("overlay node not found");
      this.overlays.splice(idx,1);       // delete the lost id
      return;
    }

    var papa = ovlNode.parentNode;

    this.holderNode.removeChild(ovlNode);
    // now delete _overlay array element
    this.overlays.splice(idx,1);       // delete the id
  }

  CanvasStack.prototype.deleteAllLayers = function()
  {
    var ovlNode;
    for (var i=this.overlays.length-1; i>=0; i--)
    {
      ovlNode = document.getElementById(this.overlays[i]);
      if (ovlNode)
      {
        this.holderNode.removeChild(ovlNode);
      }
      // now delete _overlay array element
      this.overlays.splice(i,1);       // delete the orphan
    }
  }
//@-leo

#@+leo-ver=5-thin
#@+node:ekr.20101110093449.5822: * @file mod_leo2ascd.py
__version__ = ".6" # Set version for the plugin handler.

import leo.core.leoGlobals as g
import leo.core.leoPlugins as leoPlugins

import re
import os

#@@language python
#@@tabwidth -4
#@+others
#@+node:ekr.20101110094152.5824: ** class _AssignUniqueConstantValue
class   _AssignUniqueConstantValue:
    """ Provide unique value to be used as a constant """

    #@+others
    #@+node:ekr.20101110094152.5825: *3* __init__
    def __init__(self):
        self.UniqueInternalValue = 0
        self.Assign_at_start()

    #@+node:ekr.20101110094152.5826: *3* class ConstError
    class ConstError(TypeError):
        pass
    #@+node:ekr.20101110094152.5827: *3* __setattr__
    def __setattr__(self,name,value):
        # if self.__dict__.has_key(name):
        if name in self.__dict__:
            if name != "UniqueInternalValue":
                raise self.ConstError("Can't rebind const(%s)"%name)
        self.__dict__[name]=value
    #@+node:ekr.20101110094152.5828: *3* Assign_at_start
    def Assign_at_start(self):
        self.END_PROGRAM = self.Next()   # signal abort
        self.LINE_WAS_NONE = self.Next() # describe last line printed
        self.LINE_WAS_CODE = self.Next()
        self.LINE_WAS_DOC  = self.Next()
        self.LINE_WAS_HEAD = self.Next()
        self.LINE_PENDING_NONE  = self.Next() # describe next line to be printed
        self.LINE_PENDING_CODE  = self.Next()
        self.LINE_PENDING_DOC   = self.Next()
    #@+node:ekr.20101110094152.5829: *3* Next
    def Next(self):
        self.UniqueInternalValue += 1
        return(self.UniqueInternalValue)
    #@-others
#@+node:ekr.20101110094152.5830: ** class _ConfigOptions
class _ConfigOptions:
    """Hold current configuration options."""
    #@+others
    #@+node:ekr.20101110094152.5831: *3* __init__
    def __init__(self):
        self.current = {}
        self.default = {}
        self.default["maxCodeLineLength"] = '76'
        self.default["delimiterForCodeStart"] = '~-~--- code starts --------'
        self.default["delimiterForCodeEnd"]   = '~-~--- code ends ----------'
        self.default["delimiterForCodeSectionDefinition"] = '*example*'
        self.default["headingUnderlines"] = '=-~^+'
        self.default["asciiDocSectionLevels"] = '5'
        self.default["PrintHeadings"] = "on"

    #@+node:ekr.20101110094152.5832: *3* __GetNodeOptions
    def __GetNodeOptions(self, vnode):
        bodyString = vnode.bodyString()
        lines = bodyString.splitlines()
        for line in lines:
            containsAscConfigDirective = patternAscDirectiveConfig.match(line)
            if containsAscConfigDirective:
                # Leo uses unicode, convert to plain ascii
                name = str(containsAscConfigDirective.group(1))
                value = str(containsAscConfigDirective.group(2))
                if self.current.has_key(name):
                    self.current[name] = value
                else:
                    g.es(vnode.headString())
                    g.es("  No such config option: %s" % name)

    #@+node:ekr.20101110094152.5833: *3* GetCurrentOptions
    def GetCurrentOptions(self,c,vnode):
        self.current.clear()
        self.current = self.default.copy()
        v = c.rootVnode()
        self.__GetNodeOptions(v)             # root node
        self.__GetNodeOptions(vnode)         # current node

    #@-others
#@+node:ekr.20101110094152.5834: ** assign constants
CV = _AssignUniqueConstantValue()
CV.NODE_IGNORE = CV.Next()              # demo of adding in code
Conf = _ConfigOptions()

# globals
# compile the patterns we'll be searching for frequently
patternSectionName = re.compile("\<\< *(.+?) *\>\>")
patternSectionDefinition = re.compile("(\<\< *)(.+?)( *\>\>)(=)")
patternDirective = re.compile(r"^@")
patternCodeDirective = re.compile(r"^(@c *$)|(@code)")
patternDocDirective = re.compile(r"^(@ |@doc)(.*)")
patternRootDirective = re.compile(r"^@root\s+(.+)")
patternAscDirective = re.compile(r"^@asc")

# New Leo2AsciiDoc directives
patternAscDirectiveConfig = re.compile(r'^@ascconfig\W+(\w+)\s+(\S+)')
patternAscDirectiveFile = re.compile(r'^@ascfile *"*([\w\\/\.]*)"*')
patternAscDirectiveExit = re.compile(r"^@ascexit")
patternAscDirectiveIgnore = re.compile(r"^@ascignore")
patternAscDirectiveSkip = re.compile(r"^@ascskip")
patternAscDirectiveSkipToggle = re.compile(r"^@ascskip\s*(\w+)+.*")

#@+node:ekr.20101110094152.5835: ** SectionUnderline
def SectionUnderline(h,level,v):
    'Return a section underline string.'
    asciiDocSectionLevels = int(Conf.current["asciiDocSectionLevels"])
    if level < 0:
        g.es("Section level is less than 1:\n  %s" % v.headString())
        level = 1
    elif level > asciiDocSectionLevels - 1:
        g.es("Section level is more than maximum Section Levels: %d\n  %s" \
           % (asciiDocSectionLevels, v.headString()))
        level = asciiDocSectionLevels - 1
    str = Conf.current["headingUnderlines"][level]  #'
    return str*max(len(h),1)
#@+node:ekr.20101110094152.5836: ** GetAscFilename
def GetAscFilename(c,vnode):
    'Checks a node for a filename directive.'
    # f is the Leo outline
    ascFileName = None
    bodyString = vnode.bodyString()
    lines = bodyString.splitlines()
    for line in lines:
        containsAscFileDirective = patternAscDirectiveFile.match(line)
        if containsAscFileDirective:
            ascFileName = containsAscFileDirective.group(1)
            if (ascFileName != None):
                base = os.path.split(c.mFileName)[0]  # linux or windows
                if (((base[0]=="/") and (ascFileName[0] != "/")) or 
                   ((base[1]==":") and (ascFileName[1] != ":"))): 
                    # no full pathname specified
                    ascFileName = os.path.join(base, ascFileName)
                Conf.GetCurrentOptions(vnode)
    return ascFileName
#@+node:ekr.20101110094152.5837: ** CodeChunk
def CodeChunk(text, width=72):
    """Split a line of text into a list of chunks not longer
    than width."""
    chunkList = []
    chunkStart = 0
    chunkEnd = 0
    lastSpacePosition = 0
    shortWidth = width - 4
    prefix = ''
    suffix = ' \\'
    textLen = len(text)
    if width > textLen:
        chunkList.append(text)
    else:
        while chunkEnd < textLen:
            if len(chunkList) > 0:
                prefix = '  '
            chunkEnd = chunkStart + shortWidth
            if chunkEnd > textLen:
                chunkList.append(prefix + text[chunkStart:])
                chunkEnd = textLen          # get out of jail
            else:
                lastSpacePosition = text.rfind(' ',chunkStart, chunkEnd +1)
                if lastSpacePosition != -1:  # success
                    chunkList.append(prefix + text[chunkStart:lastSpacePosition] + ' \\')
                    chunkStart = lastSpacePosition + 1
                else:
                    chunkEnd = chunkStart + shortWidth
                    chunkList.append(prefix + text[chunkStart:chunkEnd] + ' \\')
                    chunkStart = chunkEnd
    return chunkList
#@+node:ekr.20101110094152.5838: ** WriteTreeAsAsc
def WriteTreeAsAsc(vnode, ascFileN):
    'Writes the tree under vnode to the file ascFile'
    def CleanUp():
        'Cleanup on exit'
        ascFile.close()

    writeNodeReturnValue = None
    startinglevel = vnode.level()
    try:
        ascFile = file(ascFileN,'w')
    except IOError:
        g.es("Could not open output file: %s" % ascFileN)
        return
    stopHere = vnode.nodeAfterTree()
    v = vnode
    while v != stopHere:
        writeNodeReturnValue = WriteNode(v, startinglevel, ascFile)
        if  writeNodeReturnValue == CV.END_PROGRAM:
            CleanUp()
            return
        elif  writeNodeReturnValue == CV.NODE_IGNORE:
            v = v.nodeAfterTree()       # ran into an @ascignore
        else:
            v = v.threadNext()

    CleanUp()
    g.es('Wrote: '+ repr(ascFileN))
#@+node:ekr.20101110094152.5839: ** WriteNode
def WriteNode(v,startinglevel, ascFile):

    'Writes the contents of the node v to the ascFile.'

    containsAscIignore = None          # initialize
    skippingDocLines = False
    startingCodeExtract = False
    inCodeExtract = False
    statusOfWriteOutputLine = None

    def WriteOutputLine(lineString):

        'Writes a line of text to the output file.'
        try:
            ascFile.write("%s\n" % lineString)
        except IOError:
            g.es("Could not write to output file: %s" % ascFile.name)
            statusOfWriteOutputLine = CV.END_PROGRAM

    # Get the headline text.
    h = v.headString()
    markedupAsSection = patternSectionName.match(h)
    if markedupAsSection:
        h = markedupAsSection.group(1) # dump the angle brackets

    # Put the body text into a list of lines.
    bodyString = v.bodyString()
    lines = bodyString.splitlines()

    lastLinePrintedType = CV.LINE_WAS_NONE
    # By default, nodes start with a code section.
    pendinglineType = CV.LINE_PENDING_CODE

    for line in lines:
        containsRootDirective = None

        containsSectionDefinition = patternSectionDefinition.match(line)
        if containsSectionDefinition:
            # dump the angle brackets, etc.
            #       line = containsSectionDefinition.group(2)  + '\n' + \
            #       (SectionUnderline(containsSectionDefinition.group(2),2,v))
            line = '.' + containsSectionDefinition.group(2)
            pendinglineType = CV.LINE_PENDING_CODE
            startingCodeExtract = True

        containsCodeDirective = patternCodeDirective.match(line)
        if containsCodeDirective:
            pendinglineType = CV.LINE_PENDING_CODE
            skippingDocLines = False
            continue                    # don't print this line

        containsDocDirective = patternDocDirective.match(line)
        if containsDocDirective:
            pendinglineType = CV.LINE_PENDING_DOC
            if containsDocDirective.group(2):
                # it is legal to have text on the same line
                # as a doc directive.
                line = containsDocDirective.group(2)
            else:
                continue

        containsAscDirective = patternAscDirective.match(line)
        if containsAscDirective:
            containsAscIignore = patternAscDirectiveIgnore.match(line)
            if containsAscIignore:
                break

            containsAscExit = patternAscDirectiveExit.match(line)
            if containsAscExit:
                break

            containsAscSkip = patternAscDirectiveSkip.match(line)
            if containsAscSkip:
                containsAscSkipDirectiveToggle = patternAscDirectiveSkipToggle.match(line)
                if containsAscSkipDirectiveToggle:
                    if containsAscSkipDirectiveToggle.group(1).lower() == "on":
                        skippingDocLines = True
                    elif containsAscSkipDirectiveToggle.group(1).lower() == "off":
                        skippingDocLines = False
                continue

        containsOtherDirective = patternDirective.match(line)
        if containsOtherDirective:
            containsRootDirective = patternRootDirective.match(line)
            if containsRootDirective:
                line = "*note*\nThe code sections that follow, when extracted from a " + \
                       "Leo outline, will be located in: %s\n*note*" % \
                       containsRootDirective.group(1)
            else:
                continue

        # We have something to print, so print heading.
        if lastLinePrintedType == CV.LINE_WAS_NONE:
            if (len(h) > 0) and (Conf.current["PrintHeadings"] == "on"):
                WriteOutputLine("\n\n%s" % h)
                WriteOutputLine(SectionUnderline(h,v.level()-startinglevel,v))
                lastLinePrintedType = CV.LINE_WAS_HEAD

        if pendinglineType == CV.LINE_PENDING_DOC:
            if lastLinePrintedType != CV.LINE_WAS_DOC and \
               lastLinePrintedType != CV.LINE_WAS_HEAD:
                WriteOutputLine("%s" % Conf.current["delimiterForCodeEnd"])
                if inCodeExtract:
                    WriteOutputLine("\n%s" % Conf.current["delimiterForCodeSectionDefinition"])
                    inCodeExtract = False
                lastLinePrintedType = CV.LINE_WAS_DOC
            if skippingDocLines:
                if not containsRootDirective: # always document a root directive
                    continue

        if pendinglineType == CV.LINE_PENDING_CODE:
            if lastLinePrintedType != CV.LINE_WAS_CODE:
                if startingCodeExtract:
                    WriteOutputLine("\n%s" % line)
                    WriteOutputLine("%s" % Conf.current["delimiterForCodeSectionDefinition"])
                    inCodeExtract = True
                    line = ''
                WriteOutputLine("%s" % Conf.current["delimiterForCodeStart"])
                lastLinePrintedType = CV.LINE_WAS_CODE
                if startingCodeExtract:
                    startingCodeExtract = False
                    continue

            maxCodeLineLength = int(Conf.current["maxCodeLineLength"])
            if len(line) <= maxCodeLineLength:
                WriteOutputLine("%s" % line)
            elif len(line.rstrip()) <= maxCodeLineLength:
                WriteOutputLine("%s" % line.rstrip())
            else:
                lineList = CodeChunk(line, maxCodeLineLength)
                for ln in lineList:
                    WriteOutputLine("%s" % ln)
            lastLinePrintedType = CV.LINE_WAS_CODE
        else:
            WriteOutputLine("%s" % line)

        if statusOfWriteOutputLine != None:
            return statusOfWriteOutputLine

    if lastLinePrintedType == CV.LINE_WAS_CODE:
        WriteOutputLine("%s" % Conf.current["delimiterForCodeEnd"])
        if inCodeExtract:
            WriteOutputLine("\n%s" % Conf.current["delimiterForCodeSectionDefinition"])
            inCodeExtract = False

    if containsAscIignore != None:
        return CV.NODE_IGNORE # flag ignore tree to caller
#@+node:ekr.20101110094152.5841: ** WriteTreeOfCurrentNode
def WriteTreeOfCurrentNode(c):
    f = c.frame
    vnode = c.currentVnode() # get the current vnode.
    while vnode:
        ascFileN = GetAscFilename(vnode)
        if ascFileN == None:
            vnode = vnode.parent()
        else:
            break

    if ascFileN == None:
        g.es("Sorry, there was no @ascfile directive in this outline tree.")
    else:
        WriteTreeAsAsc(vnode, ascFileN)
#@+node:ekr.20101110094152.5843: ** WriteAll
def WriteAll(c):
    f = c.frame
    v = c.rootVnode()
    while v:
        ascFileN = GetAscFilename(v)
        if ascFileN != None:
            WriteTreeAsAsc(v, ascFileN)
            v = v.nodeAfterTree()
        else:
            v = v.threadNext()
#@+node:ekr.20101110094152.5845: ** WriteAllRoots
def WriteAllRoots(c):
    "Writes @root directive and/or @ascfile directive to log pane."

    patternAscDirectiveFile = re.compile(r'^@ascfile')
    patternRoot = re.compile(r'^@root')

    g.es('Looking for @root or @ascfile.')
    f = c.frame
    vnode = c.rootVnode()
    while vnode:
        bodyString = vnode.bodyString()
        lines = bodyString.splitlines()
        printedHeading = False
        for line in lines:
            printLine = False
            containsAscFileDirective = patternAscDirectiveFile.match(line)
            if containsAscFileDirective:
                printLine = True
            containsRootDirective = patternRoot.match(line)
            if containsRootDirective:
                printLine = True
            if printLine:
                if not printedHeading:
                    g.es(vnode.headString())
                    printedHeading = True
                g.es('  ' + line)
        vnode = vnode.threadNext()
#@+node:ekr.20101110094152.5847: ** CreateAscMenu
def CreateAscMenu(tag,keywords):

    """Create the Outline to AsciiDoc menu item in the Export menu."""

    c = keywords.get('c')
    if not c: return

    exportMenu = c.frame.menu.getMenu('export')
    newEntries = (
        ("-", None, None),
        ("Export all to &AsciiDoc","Alt+Shift+A",WriteAll),
        ("Export current tree to AsciiDoc","Alt+Shift+T",WriteTreeOfCurrentNode),
        ("Log all root and ascfile to log pane","Alt+Shift+L",WriteAllRoots),
    )

    c.frame.menu.createMenuEntries(exportMenu, newEntries,dynamicMenu=True)
#@-others

if 1:
    def init():
        ok = True
        leoPlugins.registerHandler(('new','menu2'), CreateAscMenu)
        g.plugin_signon(__name__)
        return ok
else:
    WriteTreeOfCurrentNode()
#@-leo

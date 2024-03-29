#@+leo-ver=5-thin
#@+node:ville.20110403115003.10348: * @file valuespace.py
#@+<< docstring >>
#@+node:ville.20110403115003.10349: ** << docstring >>
'''Supports Leo scripting using per-Leo-outline namespaces.

Commands
========

This plugin supports the following four commands:
    
vs-create-tree
--------------

Creates a tree whose root node is named 'valuespace' containing one child node
for every entry in the namespace. The headline of each child is *@@r <key>*,
where *<key>* is one of the keys of the namespace. The body text of the child
node is the value for *<key>*.

vs-dump
-------

Prints key/value pairs of the namespace.

vs-reset
--------

Clears the namespace.

vs-update
---------

Scans the entire Leo outline twice, processing *@=*, *@a* and *@r* nodes.

Pass 1
++++++

Pass 1 evaluates all *@=* and *@a* nodes in the outline as follows:
    
*@=* (assignment) nodes should have headlines of the the form::
    
    @= <var>
    
Pass 1 evaluates the body text and assigns the result to *<var>*.

*@a* (anchor) nodes should have headlines of one of two forms::
    
    @a
    @a <var>
    
The first form evaluates the script in the **parent** node of the *@a* node.
Such **bare** @a nodes serve as markers that the parent contains code to be
executed.
    
The second form evaluates the body of the **parent** of the *@a* node and
assigns the result to *<var>*.

**Important**: Both forms of *@a* nodes support the following **@x convention**
when evaluating the parent's body text. Before evaluating the body text, pass1
scans the body text looking for *@x* lines. Such lines have two forms:
    
1. *@x <python statement>*

Pass 1 executes *<python statement>*.

2. The second form spans multiple lines of the body text::
    
    @x {
    python statements
    @x }
            
Pass 1 executes all the python statements between the *@x {* and the *@x }*

3. Assign block of text to variable::

    @x =<var> {    
    Some
    Text    
    @x }
    
Pass 1 assigns the block of text to <var>. The type of value is SList,
a special sublass of standard 'list' that makes operating with string 
lists convenient. Notably, you can do <var>.n to get the content as plain
string.

A special case of this is the "list append" notation::
    
    @x =<var>+ {
    Some
    Text
    @x }
    
This assumes that <var> is a list, and appends the content as SList to this
list. You will typically do '@x var = []' earlier in the document to make this
construct work.

<var> in all contructs above can be arbitrary expression that can be on left hand
side of assignment. E.g. you can use foo.bar, foo['bar'], foo().bar etc.

Pass 2
++++++

Pass 2 "renders" all *@r* nodes in the outline into body text. *@r* nodes should
have the form::
    
    @r <expression>
    
Pass 2 evaluates *<expression>* and places the result in the body pane.

**TODO**: discuss SList expressions.

Evaluating expressions
======================

All expression are evaluated in a context that predefines Leo's *c*, *g* and *p*
vars. In addition, *g.vs* is a dictionary whose keys are *c.hash()* and whose
values are the namespaces for each commander. This allows communication between
different namespaces, while keeping namespaces generally separate.

'''

# SList docs: http://ipython.scipy.org/moin/Cookbook/StringListProcessing
#@-<< docstring >>

__version__ = '0.1'
#@+<< version history >>
#@+node:ville.20110403115003.10350: ** << version history >>
#@@killcolor
#@+at
# 
# v 0.1 VMV: Initial version.
#@-<< version history >>

#@+<< imports >>
#@+node:ville.20110403115003.10351: ** << imports >>
import leo.core.leoGlobals as g
import leo.core.leoPlugins as leoPlugins
from leo.external.stringlist import SList
    # Uses leoPlugins.TryNext.

import pprint
import re
import types, sys

#@-<< imports >>

controllers = {}
    # Keys are c.hash(), values are ValueSpaceControllers.

#@+others
#@+node:ekr.20110408065137.14221: ** Module level
#@+node:ville.20110403115003.10353: *3* colorize_headlines_visitor
def colorize_headlines_visitor(c,p, item):
    """ Changes @thin, @auto, @shadow to bold """

    if p.h.startswith("!= "):    
        f = item.font(0)
        f.setBold(True)
        item.setFont(0,f)
    raise leoPlugins.TryNext
#@+node:ville.20110403115003.10352: *3* init
def init ():
    
    # vs_reset(None)
    
    global controllers
    #g.vs = {} # A dictionary of dictionaries, one for each commander.

    # create global valuaspace controller for ipython
        
    g.visit_tree_item.add(colorize_headlines_visitor)
    
    g.registerHandler('after-create-leo-frame',onCreate)

    g.plugin_signon(__name__)

    return True

#init()
#@+node:ekr.20110408065137.14222: *3* onCreate
def onCreate (tag,key):
    
    global controllers

    c = key.get('c')
    
    if c:
        h = c.hash()
        vc = controllers.get(h)
        if not vc:
            controllers [h] = vc = ValueSpaceController(c)
#@+node:ville.20110403115003.10355: ** Commands
#@+node:ville.20130127115643.3695: *3* get_vs
def get_vs(c):
    # deal with singleton "ipython" controller
    if g.app.ipk:        
        vsc = controllers.get('ipython')
        if not vsc:
            controllers['ipython'] = vsc = ValueSpaceController(c = None,
                ns = g.app.ipk.namespace)

        vsc.set_c(c) 
        
        return vsc
                    
    return controllers[c.hash()]
    
#@+node:ville.20110407210441.5691: *3* vs-create-tree
@g.command('vs-create-tree')
def vs_create_tree(event):
    
    """Create tree from all variables."""

    get_vs(event['c']).create_tree()

#@+node:ekr.20110408065137.14227: *3* vs-dump
@g.command('vs-dump')
def vs_dump(event):
    
    """Dump the valuespace for this commander."""
    get_vs(event['c']).dump()    
#@+node:ekr.20110408065137.14220: *3* vs-reset
@g.command('vs-reset')
def vs_reset(event):

    # g.vs = types.ModuleType('vs')
    # sys.modules['vs'] = g.vs

    get_vs(event['c']).reset()    
#@+node:ville.20110403115003.10356: *3* vs-update
@g.command('vs-update')
def vs_update(event):

    get_vs(event['c']).update()    
#@+node:ekr.20110408065137.14219: ** class ValueSpaceController
class ValueSpaceController:
    
    '''A class supporting per-commander evaluation spaces
    containing @a, @r and @= nodes.
    '''
    
    #@+others
    #@+node:ekr.20110408065137.14223: *3*  ctor
    def __init__ (self,c = None, ns = None ):
        
        # g.trace('(ValueSpaceController)',c)
        
        self.c = c
        if ns is None:
            self.d = {}
        else:
            self.d = ns
        
        self.reset()    
        self.trace = True
        self.verbose = False
        
        # changed g.vs.__dict__ to self.d
        # Not strictly necessary, but allows cross-commander communication.
        #g.vs [c.hash()] = self.d
    #@+node:ekr.20110408065137.14224: *3* create_tree
    def create_tree (self):
        
        '''The vs-create-tree command.'''
        
        c = self.c ; p = c.p ; tag = 'valuespace'

        # Create a 'valuespace' node if p's headline is not 'valuespace'.
        if p.h == tag:
            r = p
        else:
            r = p.insertAsLastChild()
            r.h = tag

        # Create a child of r for all items of self.d
        for k,v in self.d.items():
            if not k.startswith('__'):
                child = r.insertAsLastChild()
                child.h = '@@r ' + k
                self.render_value(child,v) # Create child.b from child.h
                
        c.bodyWantsFocus()
        c.redraw()        
    #@+node:ekr.20110408065137.14228: *3* dump
    def dump (self):
        
        c,d = self.c,self.d
        
        exclude = (
            '__builtins__',
            # 'c','g','p',
        )
        
        print('Valuespace for %s...' % c.shortFileName())
        keys = list(d.keys())
        keys = [z for z in keys if z not in exclude]
        keys.sort()
        max_s = 5
        for key in keys:
            max_s = max(max_s,len(key))
        for key in keys:
            val = d.get(key)
            pad = max(0,max_s-len(key))*' '
            print('%s%s = %s' % (pad,key,val))
            
        c.bodyWantsFocus()
    #@+node:ekr.20110408065137.14225: *3* reset
    def reset (self):
        
        '''The vs-reset command.'''

        # do not allow resetting the dict if using ipython
        if not g.app.ipk:
            self.d = {}
            self.c.vs = self.d
        
        self.init_ns(self.d)
        
    #@+node:ville.20110409221110.5755: *3* init_ns
    def init_ns(self,ns):
        """ Add 'builtin' methods to namespace """
        
        def slist(body):
            """ Return body as SList (string list) """
            return SList(body.split("\n"))

        ns['slist'] = slist
        
        # xxx todo perhaps add more?
            
    #@+node:ville.20130127122722.3696: *3* set_c
    def set_c(self,c):
        """ reconfigure vsc for new c
        
        Needed by ipython integration
        """
        self.c = c
    #@+node:ekr.20110408065137.14226: *3* update & helpers
    def update (self):
        
        '''The vs-update command.'''


        # names are reversed, xxx TODO fix later    
        self.render_phase() # Pass 1
        self.update_vs()    # Pass 2
        self.c.bodyWantsFocus()
    #@+node:ekr.20110407174428.5781: *4* render_phase (pass 1) & helpers
    def render_phase(self):
        '''Update p's tree (or the entire tree) as follows:

        - Evaluate all @= nodes and assign them to variables
        - Evaluate the body of the *parent* nodes for all @a nodes.
        '''
        
        c = self.c
        self.d['c'] = c # g.vs.c = c
        self.d['g'] = g # g.vs.g = g
        for p in c.all_unique_positions():       
            h = p.h.strip()
            if h.startswith('@= '):
                if self.trace and self.verbose: g.trace('pass1',p.h)
                self.d['p'] = p.copy() # g.vs.p = p.copy()
                var = h[3:].strip()
                self.let_body(var,self.untangle(p))
            elif h == '@a' or h.startswith('@a '):
                if self.trace and self.verbose: g.trace('pass1',p.h)  
                tail = h[2:].strip()
                parent = p.parent()
                if tail:
                    self.let_body(tail,self.untangle(parent))                
                self.parse_body(parent)
        # g.trace(self.d)
    #@+node:ekr.20110407174428.5777: *5* let & let_body
    def let(self,var,val):
        
        '''Enter var into self.d with the given value.
        Both var and val must be strings.'''
        
        if self.trace:
            print("Let [%s] = [%s]" % (var,val))
        self.d ['__vstemp'] = val
        if var.endswith('+'):
            rvar = var.rstrip('+')
            # .. obj = eval(rvar,self.d)        
            exec("%s.append(__vstemp)" % rvar,self.d)
        else:
            exec(var + " = __vstemp",self.d)
        del self.d ['__vstemp']
        
    def let_cl(self, var, body):
        """ handle @cl node """
        # g.trace()
        lend = body.find('\n')
        firstline = body[0:lend]
        rest = firstline[4:].strip()
        print("rest",rest)  
        translator = eval(rest, self.d)
        translated = translator(body[lend+1:])
        self.let(var, translated)
        
    def let_body(self,var,val):
        # SList docs: http://ipython.scipy.org/moin/Cookbook/StringListProcessing
        
        #lend = val.find('\n')
        #firstline = val[0:lend]
        
        #lines = val.strip().split('\n')
        if val.startswith('@cl '):
            self.let_cl(var, val)
            return
            
        #self.let(var,SList(lines))
        self.let(var,val)
        
        
    #@+node:ekr.20110407174428.5780: *5* parse_body & helpers
    def parse_body(self,p):
        
        body = self.untangle(p) # body is the script in p's body.
        # print("Body")
        # print(body)
        if self.trace and self.verbose: g.trace('pass1',p.h,'\n',body)
        self.d ['p'] = p.copy()
        backop = None
        segs = re.finditer('^(@x (.*))$',body,re.MULTILINE)
        for mo in segs:
            op = mo.group(2).strip()
            # print("Oper",op)
            if op.startswith('='):
                # print("Assign", op)
                backop = ('=', op.rstrip('{').lstrip('='), mo.end(1))
            elif op == '{':
                backop = ('runblock', mo.end(1))
            elif op == '}':
                bo = backop[0]
                # print("backop",bo)
                if bo == '=':
                    self.let_body(backop[1].strip(), body[backop[2] : mo.start(1)])
                elif bo == 'runblock':
                    self.runblock(body[backop[1] : mo.start(1)])
            else:
                self.runblock(op)
    #@+node:ekr.20110407174428.5779: *6* runblock
    def runblock(self,block):

        if self.trace and self.verbose:
            g.trace('pass1',block)

        exec(block,self.d)
    #@+node:ekr.20110407174428.5778: *6* untangle (getScript)
    def untangle(self,p):
        
        return g.getScript(self.c,p,
            useSelectedText=False,
            useSentinels=False)
    #@+node:ekr.20110407174428.5782: *4* update_vs (pass 2) & helper
    def update_vs(self):
        
        '''Evaluate @r <expr> nodes, puting the result in their body text.'''
        
        c = self.c
        for p in c.all_unique_positions():
            h = p.h.strip()
            if h.startswith('@r '):
                if self.trace and self.verbose: g.trace('pass2:',p.h)
                expr = h[3:].strip()
                result = eval(expr,self.d)
                if self.trace: print("Eval:",expr,"result:",repr(result))
                self.render_value(p,result)
    #@+node:ekr.20110407174428.5784: *5* render_value
    def render_value(self,p,value):
        
        '''Put the rendered value in p's body pane.'''

        if isinstance(value, SList):
            p.b = value.n
        elif g.isString(value): # Works with Python 3.x.
            p.b = value
        else:
            p.b = pprint.pformat(value)
    #@+node:ekr.20110407174428.5783: *3* test
    def test(self):
        self.update()

    # test()
    #@-others
#@-others
#@-leo

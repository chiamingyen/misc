# -*- coding: utf-8 -*-
from docutils import nodes
import sphinx.writers.latex as latex
from sphinx.util.nodes import clean_astext
import pdb
def doctree_resolved(app, doctree, docname):
    """將帶sec-開頭的target標籤名添加到標籤的父節點之上
    這樣就可以在section節點之下定義章節的標籤。便於用
    leo的auto-rst功能編輯rst文檔。
    
    例如：
    
    章節名稱
    --------
    
    .. _sec-test:

    章節內容
    """
    for node in doctree.traverse(nodes.target):
        if node.get("refid", "").startswith("sec-"):
            section = node.parent
            section["ids"].append(node["refid"])
            node["refid"] = "-" + node["refid"]

def doctree_read(app, doctree):
    """
    為了sec-開頭標籤能正常工作需要將其添加進：
    env.domains["std"].data["labels"]
    sec-test: 文章名, 標籤名, 章節名，
    """
    labels = app.env.domains["std"].data["labels"]
    for name, _ in doctree.nametypes.items():
        if not name.startswith("sec-"): continue
        labelid = doctree.nameids[name]
        node = doctree.ids[labelid].parent
        if node.tagname == 'section':
            sectname = clean_astext(node[0])
            labels[name] = app.env.docname, labelid, sectname
            
def setup(app):
    print ("number_ref loaded")
    old_visit_reference = latex.LaTeXTranslator.visit_reference
    def visit_reference(self, node):
        uri = node.get('refuri', '')
        hashindex = uri.find('#')
        if hashindex == -1:
            id = uri[1:] + '::doc'
        else:
            id = uri[1:].replace('#', ':')
        if uri.startswith("%") and "#fig-" in uri:
            self.body.append(self.hyperlink(id))
            self.body.append("圖\\ref*{%s}" % id)
            self.context.append("}}")
            raise nodes.SkipChildren
        elif uri.startswith("%") and "#sec-" in uri:
            self.body.append(self.hyperlink(id))
            self.body.append("第\\ref*{%s}節" % id)
            self.context.append("}}")
            raise nodes.SkipChildren        
        else:
            return old_visit_reference(self, node)
    latex.LaTeXTranslator.visit_reference = visit_reference
    
    app.connect("doctree-read", doctree_read)
    app.connect("doctree-resolved", doctree_resolved)

#@+leo-ver=5-thin
#@+node:myleobook1.20130226133026.3012: * @file pyforum.py
#@@language python
#coding: utf8
#@+<< license >>
#@+node:myleobook1.20130226133026.3013: ** << license >>
'''
/**************************************************************************\
* Pyforum 0.01
* http://cmsimple.cycu.org
* Copyright (C) 2013 by Chiaming Yen
* ------------------------------------------------------------------------
*  This program is free software; you can redistribute it and/or 
*  modify it under the terms of the GNU General Public License Version 2
*  as published by the Free Software Foundation; only version 2
*  of the License, no later version. 
* 
*  This program is distributed in the hope that it will be useful,
*  but WITHOUT ANY WARRANTY; without even the implied warranty of
*  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
*  GNU General Public License for more details.
* 
*  You should have received a copy of the GNU General Public License
*  Version 2 along with this program; if not, write to the Free Software
*  Foundation, Inc., 59 Temple Place - Suite 330, Boston,
*  MA  02111-1307, USA. 
\**************************************************************************/

'''
#@-<< license >>
#@+<< comment >>
#@+node:myleobook1.20130226202854.2727: ** << comment >>
# 在 OpenShift 平台上, 完成靜態路徑與 data 檔案設定, 將資料庫存到 data 目錄
# rhc alias add pyforum pyforum.edx.tw
# 將 pyforum-cmsimple.rhcloud.com 指向 pyforum.edx.tw
# 已經透過 site_config 設定, 可以同時在 OpenShift 與 local 平台上運作
# 在 local 運作時, 資料庫檔案存在 V:/pyforum_db, 而 tmp, downloads, templates 則在網際根目錄.
# 分別在 templates 與 downloads 目錄中設定內建的 index 為 index.htm, 且為空檔案, 避免單獨連結 templates 目錄時, 會 show 出 index.html 板型檔案
# 在 OpenShift 平台時, 必須要自行利用  sftp 將 downloads 目錄中的 index.htm 送到網站
#
# 2013.01.20 開始導入 Mako template engine
#
# 2013.02.01 已經在 Mako 模式下完成分頁
# 準備將關鍵字搜尋結果進行分頁, 必須要使用 session?
# 2013.02.03 已經完成搜尋結果分頁, 接下來要處理多重掛檔
#
# 2012.12.26 定名 Pyforum, 主要利用類似 SForum 的架構儲存資料
#
# 需要 HTML.py 與 pybean.py 等模組
# 先推出基本上可以運作的 pyforum1.py
# 決定是否要使用 template 機制
#
# 處理多選項 checkbox 的資料數列存檔
#
# 若利用 python 儲存網頁內容, 或許需要 cgi.escape()等同 php htmlspecialchars()
'''
import cgi
print cgi.escape("<a href='test'>Test</a>", True)
# &lt;a href=&#039;test&#039;&gt;Test&lt;/a&gt;
'''
# 希望將資料以 pybean 存在 sqlite3 檔案中
# 2012.12.16 發現在 Python 3.3 環境 CherryPy 3.2.2 會經常發生 port not bound error
# 2012.12.25 利用 uuid 唯一代號處理資料更新與刪除
# 希望加入跨欄位查詢資料的功能
#
# 必須增加分頁的效率, 目前並非局部查詢, 而是全部放入數列後再分頁, 使用資料庫處理是否會較快?
# 分頁可以採用 library.find("student","1 order by stud_number limit 1,10"):
# 注意: 新增資料時, 至少要有學號資料
# 後續修改將針對各筆資料, 將增加一個唯一號碼的序號
# 後續將要增加資料刪除與查詢, 以及資料分頁
# 已經完成初步分頁功能, 導入 math 主要用於分頁 math.ceil
#@-<< comment >>
#@+<< imports >>
#@+node:myleobook1.20130228000334.8070: ** << imports >>
import cherrypy, sys, os
import HTML, math
# 請注意, 上傳大檔案的方法, 不能同時傳送其他欄位資料, 因此必須單獨處理檔案上傳,
# 然後將上傳檔案資料存在資料庫或資料檔
# 為了處理上傳的大檔案, 導入 cgi 與 tempfile
import cgi, tempfile
# 用於 pybean 資料儲存
from pybean import Store, SQLiteWriter
from uuid import *
# for mako
from mako.template import Template
from mako.lookup import TemplateLookup
#@-<< imports >>
#@+<< myFieldStorage >>
#@+node:myleobook1.20130226202854.2728: ** << myFieldStorage >> (大檔傳輸類別)
# 這是用來上傳大檔案所需的類別
class myFieldStorage(cgi.FieldStorage):
    """Our version uses a named temporary file instead of the default
    non-named file; keeping it visibile (named), allows us to create a
    2nd link after the upload is done, thus avoiding the overhead of
    making a copy to the destination filename."""
    
    def make_file(self, binary=None):
        return tempfile.NamedTemporaryFile()
 
# 這是用來上傳大檔案所需的類別 
def noBodyProcess():
    """Sets cherrypy.request.process_request_body = False, giving
    us direct control of the file upload destination. By default
    cherrypy loads it to memory, we are directing it to disk."""
    cherrypy.request.process_request_body = False
 
cherrypy.tools.noBodyProcess = cherrypy.Tool('before_request_body', noBodyProcess)
#@-<< myFieldStorage >>
#@+<< platform setup >>
#@+node:myleobook1.20130228000334.8071: ** << platform setup >> (平台執行設定)
# site_config could be "OpenShift" or "local"
# 將 site_config 設為 "OpenShift" 表示程式將在 OpenSite 平台中執行, 否則就是在 local 執行
site_config = "local"
if site_config == "OpenShift":
    SQLite_data_dir = os.environ['OPENSHIFT_DATA_DIR']
    download_root_dir = os.environ['OPENSHIFT_DATA_DIR']
    template_root_dir = os.environ['OPENSHIFT_REPO_DIR']+"/wsgi/static"
else:
    目前目錄 = os.getcwd()
    print(目前目錄)
    SQLite_data_dir = 目前目錄+"\\pyforum_db"
    download_root_dir = 目前目錄
    template_root_dir = 目前目錄
#@-<< platform setup >>
#@+others
#@+node:myleobook1.20130228000334.8049: ** class 個人資料處理(object)
# os 用於 unlink 檔案 (即刪除檔案用), 以及呼叫執行 Chrome 瀏覽器
class 個人資料處理(object):
    _cp_config = {
    # 配合 utf-8 格式之表單內容
    # 若沒有 utf-8 encoding 設定,則表單不可輸入中文
    'tools.encode.encoding': 'utf-8',
    # 加入 session 設定
    'tools.sessions.on' : True,
    'tools.sessions.storage_type' : 'file',
    'tools.sessions.locking' : 'explicit',
    'tools.sessions.storage_path' : './tmp',
    # 內定的 session timeout 時間為 60 分鐘
    'tools.sessions.timeout' : 60
    }
    '''
        取 count session 值, 內定為 0: cherrypy.session.get('count', 0)
        設定 session 中 count 的值: cherrypy.session['count'] = count
 
        # delete all session data
        #cherrypy.session.delete()
        # only delete 'count' session
        del cherrypy.session['count']
    '''
    # 網際表單
    # 請注意改為 uuid 辨識唯一資料代號後, 是否需要配合修改
    # 設法改為 Mako based 表單
    
    #@+others
    #@+node:myleobook1.20130228000334.8050: *3* index
    def index(self,stud_number=None,stud_name=None):
        套稿查詢 = TemplateLookup(directories=['templates'])
        # 必須要從 templates 目錄取出 index.html
        內建頁面 = 套稿查詢.get_template("index.html")
        #座位套稿 = Template(filename='templates/index.html', format_exceptions=True, lookup=套稿查詢)
        #return 座位套稿.render(currentTime=datetime.datetime.now())
        # 這裡必須要在 pagelist.html 中設法利用 page_now 與 itemperpage 建立頁面轉換的表單
        # 而 inputList 數列也必須與 page 及 itemperpage 進行互動, 以便送出不同頁面的內容數列
        return 內建頁面.render(stud_number=stud_number, stud_name=stud_name)
        #
        # 已經改完 Mako based, 以下資料可以刪除?
        目前所在目錄 = os.path.dirname(os.path.abspath(__file__))
        outString = '''
        資料新增表單 <br /><br />
        <form method="post" action="doAct" enctype="multipart/form-data">
        
        學號:<input type="text" name="stud_number"
        '''
        
        if (stud_number != None):
            outString += ''' value="'''+str(stud_number)+'''"><br />'''
        else:
            outString += '''><br />'''
        
        outString += '''
        姓名:<input type="text" name="stud_name"
        '''
        
        if (stud_name != None):
            outString += ''' value="'''+str(stud_name)+'''"><br />'''
        else:
            outString += '''><br />'''
        outString += '''
        高中科系:<input type="text" name="school_dept"><br />
        專長:<input type="text" name="major"><br />
        預計薪資:<input type="text" name="expt_salary"><br />
        檔案:<input type="file" name="fileupload"><br />
        <input type="submit" value="新增">
        <input type="reset" value="重填">
        </form>
        '''+self.menuLink()
        return outString

    index.exposed = True
    #@+node:myleobook1.20130228000334.8051: *3* searchForm
    # 設法改為 Mako based
    def searchForm(self):
        套稿查詢 = TemplateLookup(directories=['templates'])
        # 必須要從 templates 目錄取出 index.html
        資料搜尋 = 套稿查詢.get_template("searchform.html")
        #座位套稿 = Template(filename='templates/index.html', format_exceptions=True, lookup=套稿查詢)
        #return 座位套稿.render(currentTime=datetime.datetime.now())
        # 這裡必須要在 pagelist.html 中設法利用 page_now 與 itemperpage 建立頁面轉換的表單
        # 而 inputList 數列也必須與 page 及 itemperpage 進行互動, 以便送出不同頁面的內容數列
        return 資料搜尋.render()
    searchForm.exposed = True
    #@+node:myleobook1.20130228000334.8052: *3* doSearch
    def doSearch(self, keyword=None, key_num=0, rev_order=False, itemperpage=9, page=1):
        # 這裡的搜尋結果分頁, 先確定搜尋筆數, 然後配合每頁筆數與所在頁面進行局部搜尋, 並將搜尋關鍵字存在 session, 在 Mako 版型檔中取出配合不同頁面進行顯示
        # 以下改為以 pybean 儲存資料
        # 取 count session 值, 內定為 0: cherrypy.session.get('count', 0)
        # 設定 session 中 count 的值: cherrypy.session['count'] = count
        # 先將 keyword 放到 session 中
        if keyword != "":
            cherrypy.session['keyword'] = keyword
        else:
            # 利用 Mako 傳回相關資料
            return "請輸入查詢關鍵字(非 Mako)"
        library = Store(SQLiteWriter(SQLite_data_dir+"/database.sqlite", frozen=False))
        # 動態建立 student 資料表
        student = library.new("student")
        # 以 find 找出所要的一筆資料
        # 設法利用所有欄位名稱拼湊查詢字串
        次序 = 1
        查詢字串 = ""
        for 索引 in ["stud_number", "stud_name", "school_dept", "major", "expt_salary"]:
            if 次序 == 1:
                查詢字串 += "("+索引+" like \"%"+keyword+"%\")"
            else:
                查詢字串 += "OR ("+索引+" like \"%"+keyword+"%\")"
            次序 += 1
            
        #查詢資料 = library.find("student",查詢字串)
        # 先確認查詢總筆數
        totalitem = library.count("student",查詢字串)
        # 處理查詢無資料傳回的情況
        if totalitem == 0:
            return "查無對應資料"
        totalpage = math.ceil(totalitem/int(itemperpage))
        # 若索引從 1 開始
        #starti = int(itemperpage) * (int(page) - 1) + 1
        # 若索引從 0 開始
        starti = int(itemperpage) * (int(page) - 1)
        endi = starti + int(itemperpage) - 1
        查詢資料 = library.find("student", 查詢字串+" order by stud_number limit "+str(starti)+", "+str(itemperpage))

        個人資料 = []
        for 資料 in 查詢資料:
        #for 資料 in library.find("student","1 order by stud_number limit 1,10"):
            學號 = 資料.stud_number
            姓名 = 資料.stud_name
            科系 = 資料.school_dept
            專長 = 資料.major
            薪水 = 資料.expt_salary
            #更新連結 = "<a href=\"updateForm?stud_number="+學號+"\">"+學號+"</a>"
            更新連結 = "<a href=\"updateForm?uuid="+str(資料.uuid)+"\">"+學號+"</a>"
            更新 = "<a href=\"updateForm?uuid="+str(資料.uuid)+"\">更新</a>"
            刪除 = "<a href=\"deleteForm?uuid="+str(資料.uuid)+"\">刪除</a>"
            個人資料.append([更新連結,姓名,科系,專長,薪水,更新,刪除])
        # 是否要將搜尋所得的個人資料, 以 Mako 套稿處理
        #
        # 根據數列中各 tuple 中的學號(亦即 key data[0])進行排序
        # 個人資料排列後, 必須加以指定成變數, 否則個人資料的內容排序後並未改變
        #個人資料 = sorted(個人資料, key=lambda data: data[0], reverse=True)
        個人資料 = sorted(個人資料, key=lambda data: data[int(key_num)], reverse=int(rev_order))
        #print(個人資料)
        #outString = self.htmlList(個人資料)
        # 由於搜尋結果的分頁顯示, 為特定內容的分頁顯示與一般全部資料的顯示是否要進行區分, 必須在此作決定
        # 由於所有資料的分頁顯示, 是以 itemperpage 與 page 針對所有資料進行資料庫查詢後, 逐批送到 pageList 進行顯示
        # 而資料搜尋是否要每次利用相同的流程處理顯示, 抑或透過將搜尋資料存入 session  然後再由 session 分頁取出顯示, 效益有何差別
        # 也必須在此進行分析
        outString = self.spageList(個人資料,totalitem,itemperpage,page)
        return outString
    doSearch.exposed = True
    #@+node:myleobook1.20130228000334.8053: *3* deleteForm
    # 刪除表單, 根據 uuid 代號, 列出要刪除的資料, 然後再 doDelete 進行資料刪除
    # 設法改為 Mako based
    def deleteForm(self,uuid=None):
        # 設法根據 stud_number 查出對應的欄位資料
        # 改為利用 uuid 查出對應的欄位資料, uuid 為各筆資料的唯一代號
        個人資料 = []
        資料計數 = 0
        # 以下改為以 pybean 儲存資料
        library = Store(SQLiteWriter(SQLite_data_dir+"/database.sqlite", frozen=False))
        # 動態建立 student 資料表
        student = library.new("student")
        # 以 find_one 找出所要的一筆資料
        #一筆資料 = library.find_one("student","stud_number=?",[stud_number])
        #UUID(uuid).bytes 為正確的 uuid 欄位資料
        一筆資料 = library.find_one("student","uuid=?",[UUID(uuid).bytes])
        stud_number = 一筆資料.stud_number
        stud_name = 一筆資料.stud_name
        school_dept = 一筆資料.school_dept
        major = 一筆資料.major
        expt_salary = 一筆資料.expt_salary
        outString = '''
        資料刪除表單 <br /><br />
        按下刪除後, 下列資料將會刪除 <br /><br />
        <form method=\"post\" action=\"doDelete\">
        '''
        outString += "學號:"+str(stud_number)+"<br />"
        outString += "姓名:"+str(stud_name)+"<br />"
        outString += "高中科系:"+str(school_dept)+"<br />"
        outString += "專長:"+str(major)+"<br />"
        outString += "預計薪資:"+str(expt_salary)+"<br />"
        # 將資料對應的 uuid 以隱藏資料送回, 這裡或許會有資料安全疑慮?
        outString += "<input type=\"hidden\" name=\"uuid\" value=\""+str(uuid)+"\"><br />"
        outString += '''
        <input type=\"submit\" value=\"刪除\">
        </form>
        '''+self.menuLink()
        return outString
        
    deleteForm.exposed = True
    #@+node:myleobook1.20130228000334.8054: *3* cmsinput
    # 網際表單, 採用 textarea, 希望導入 ckeditor, 以便當作 CMS 使用
    # 設法改為 Mako based
    def cmsinput(self):
        套稿查詢 = TemplateLookup(directories=['templates'])
        # 必須要從 templates 目錄取出 index.html
        內容輸入 = 套稿查詢.get_template("cmsinput.html")
        #座位套稿 = Template(filename='templates/index.html', format_exceptions=True, lookup=套稿查詢)
        #return 座位套稿.render(currentTime=datetime.datetime.now())
        # 這裡必須要在 pagelist.html 中設法利用 page_now 與 itemperpage 建立頁面轉換的表單
        # 而 inputList 數列也必須與 page 及 itemperpage 進行互動, 以便送出不同頁面的內容數列
        return 內容輸入.render()
    cmsinput.exposed = True
    #@+node:myleobook1.20130228000334.8055: *3* updateForm
    # updateForm 應該要透過資料表列中, 使用者選擇 index 序號, 然後程式由資料檔
    # 中調出對應的現有欄位資料, 然後以 value = ... 進行表單的內容後, 讓使用者進行修改
    # 設法改為 Mako based
    #def updateForm(self,stud_number=None):
    def updateForm(self,uuid=None):
        # 設法根據 stud_number 查出對應的欄位資料
        # 改為利用 uuid 查出對應的欄位資料, uuid 為各筆資料的唯一代號
        個人資料 = []
        資料計數 = 0
        # 以下改為以 pybean 儲存資料
        library = Store(SQLiteWriter(SQLite_data_dir+"/database.sqlite", frozen=False))
        # 動態建立 student 資料表
        student = library.new("student")
        # 以 find_one 找出所要的一筆資料
        #一筆資料 = library.find_one("student","stud_number=?",[stud_number])
        #UUID(uuid).bytes 為正確的 uuid 欄位資料
        一筆資料 = library.find_one("student","uuid=?",[UUID(uuid).bytes])
        stud_number = 一筆資料.stud_number
        stud_name = 一筆資料.stud_name
        school_dept = 一筆資料.school_dept
        major = 一筆資料.major
        expt_salary = 一筆資料.expt_salary
        outString = '''
        資料更新表單 <br /><br />
        <form method=\"post\" action=\"doUpdate\">
        '''
        outString += "學號:<input type=\"text\" name=\"stud_number\" value=\""+str(stud_number)+"\"><br />"
        outString += "姓名:<input type=\"text\" name=\"stud_name\" value=\""+str(stud_name)+"\"><br />"
        outString += "高中科系:<input type=\"text\" name=\"school_dept\" value=\""+str(school_dept)+"\"><br />"
        outString += "專長:<input type=\"text\" name=\"major\" value=\""+str(major)+"\"><br />"
        outString += "預計薪資:<input type=\"text\" name=\"expt_salary\" value=\""+str(expt_salary)+"\"><br />"
        # 將資料對應的 uuid 以隱藏資料送回, 這裡或許會有資料安全疑慮?
        outString += "<input type=\"hidden\" name=\"uuid\" value=\""+str(uuid)+"\"><br />"
        outString += '''
        <input type=\"submit\" value=\"更新\">
        <input type=\"reset\" value=\"重填\">
        </form>
        '''+self.menuLink()
        return outString
        
    updateForm.exposed = True
    #@+node:myleobook1.20130228000334.8056: *3* doAct
    # 配合大檔案上傳設定
    # 除了使用 index.exposed = True 外也可以使用下列設定
    #@verbatim
    #@cherrypy.expose
    #@verbatim
    #@cherrypy.tools.noBodyProcess()
    # 表單處理函式
    def doAct(self, stud_number=None, stud_name=None, \
                    school_dept=None, major=None, expt_salary=None, fileupload=None):
        outString = ""
        outString += "學號:"+str(stud_number)
        outString += "<br />"
        outString += "姓名:"+str(stud_name)
        outString += "<br />"
        outString += "高中科系:"+str(school_dept)
        outString += "<br />"
        outString += "專長:"+str(major)
        outString += "<br />"
        outString += "預計薪資:"+str(expt_salary)
        outString += "<br />"

        # 處理檔案上傳, 這裡將檔案暫存在記憶體, 因此無法上傳大檔案
        # 加上 fileupload 變數的判別在 if 前方, 可以避免表單無 fileupload 變數所產生的問題
        if fileupload and (fileupload.file != None):
            資料檔案目錄 = os.environ['OPENSHIFT_DATA_DIR']
            上傳目錄 = 資料檔案目錄 + "/downloads"
            if not os.path.exists(上傳目錄):
                os.makedirs(上傳目錄)
            #目前所在目錄 = os.path.dirname(os.path.abspath(__file__))
            上傳檔案 = open(資料檔案目錄+"/downloads/"+fileupload.filename, 'wb')
            檔案大小 = 0
            檔案 = None
            while True:
                data = fileupload.file.read(8192)
                if not data:
                    break
                檔案大小 += len(data)
                上傳檔案.write(data)
            outString += "上傳檔案名稱:"+str(fileupload.filename)+"<br />"
            outString += "檔案大小:"+str(檔案大小)+"<br />"
            outString += "檔案類別:"+str(fileupload.content_type)+"<br />"
            上傳檔案.close()
        '''
            以下兩行用於檔案上傳 debug 用, 以確認檔案是否上傳
            if os.path.isfile(資料檔案目錄+"/downloads/"+fileupload.filename):
                outString += "檔案已經存在:"+資料檔案目錄+"/downloads/"+fileupload.filename

        # 大檔案上傳應該要能選擇多檔案, 並且上傳後, 將上傳檔案列表存入資料庫
        # 以下為大檔案上傳的處理程式
        # the file transfer can take a long time; by default cherrypy
        # limits responses to 300s; we increase it to 1h
        cherrypy.response.timeout = 3600
        
        # convert the header keys to lower case
        
        lcHDRS = {}
        for key, val in cherrypy.request.headers.items():
            lcHDRS[key.lower()] = val
            print(key,val)
        # at this point we could limit the upload on content-length...
        # incomingBytes = int(lcHDRS['content-length'])
        
        # create our version of cgi.FieldStorage to parse the MIME encoded
        # form data where the file is contained
        formFields = myFieldStorage(fp=cherrypy.request.rfile,
                                    headers=lcHDRS,
                                    environ={'REQUEST_METHOD':'POST'},
                                    keep_blank_values=True)
        
        # we now create a 2nd link to the file, using the submitted
        # filename; if we renamed, there would be a failure because
        # the NamedTemporaryFile, used by our version of cgi.FieldStorage,
        # explicitly deletes the original filename
        theFile = formFields['fileupload']
        stud_number = formFields['stud_number']
        stud_name = formFields['stud_name']
        school_dept == formFields['school_dept']
        major = formFields['major']
        expt_salary = formFields['expt_salary']
        os.link(theFile.file.name, 'downloads/'+theFile.filename)
        # 結束大檔案上傳的處理程式
        '''
        #
        # 最後列出連結功能表單
        outString += self.menuLink()
        # 將資料存入檔案 (或資料庫)
        self.saveData(stud_number, stud_name, \
                    school_dept, major, expt_salary)
        return outString
    doAct.exposed = True
    #@+node:myleobook1.20130228000334.8057: *3* saveData
    # 輸入資料存檔
    def saveData(self, stud_number=None, stud_name=None, \
                    school_dept=None, major=None, expt_salary=None):
        '''
        # 以 append 附加的方式將資料存入檔案, 以逗點隔開
        檔案 = open("c1w10out.txt", 'a', encoding="utf-8")
        內容 = str(stud_number)+","+str(stud_name)+","\
        +str(school_dept)+","+str(major)+','+str(expt_salary)+"\n"
        檔案.write(內容)
        檔案.close()
        '''
        # 改為將資料透過 pybean 存入資料庫
        library = Store(SQLiteWriter(SQLite_data_dir+"/database.sqlite", frozen=False))
        # 動態建立 student 資料表
        student = library.new("student")
        # 改為以 pybean 儲存資料
        student.stud_number = stud_number
        student.stud_name = stud_name
        student.school_dept = school_dept
        student.major = major
        student.expt_salary = expt_salary
        # 儲存資料表內容
        library.save(student)
        # 設法改為 Mako based
        return str(stud_number)+","+str(stud_name)+","\
        +str(school_dept)+","+str(major)+','+str(expt_salary)+", 已經存檔"
    #@+node:myleobook1.20130228000334.8058: *3* readData
    # 由資料檔案讀出, 並且進行排序或表格列印, 欄位資料加總等流程
    def readData(self, key_num=0, rev_order=False, itemperpage=9, page=1):
        # 處理 itemperpage 與 page 為 0 或小於 0 的情況, 因為由 URL 取回的變數型別為字串, 因此以字串判別
        if itemperpage == "0" or page == "0" or int(itemperpage) < 0 or int(page) < 0 :
            itemperpage = 9
            page = 1
        #
        個人資料 = []
        資料計數 = 0

        # 以下改為以 pybean 儲存資料
        library = Store(SQLiteWriter(SQLite_data_dir+"/database.sqlite", frozen=False))
        # 動態建立 student 資料表
        student = library.new("student")
        # 列出目前的資料庫內容
        if (library.count("student") == 0):
            outString = "沒有資料, 請先輸入資料!<br />"
            outString += self.menuLink()
            return outString
        else:
            # 這裡在查找所有資料"1 order by id limit $starti,$item_per_page"
            # 利用 page 與 itemperpage 計算 startnum 與 endnum
            #
            # 由資料庫中的 student 資料表計算資料筆數
            totalitem = library.count("student")
            totalpage = math.ceil(totalitem/int(itemperpage))
            # 若索引從 1 開始
            #starti = int(itemperpage) * (int(page) - 1) + 1
            # 若索引從 0 開始
            starti = int(itemperpage) * (int(page) - 1)
            endi = starti + int(itemperpage) - 1
            # 必須要送到 Mako 的變數值 totalitem, page, itemperpage
            # 這裡要考量送回全部資料, 或者只送出特定頁面的所屬資料數列

            #for 資料 in library.find("student","1"):
            for 資料 in library.find("student","1 order by stud_number limit "+str(starti)+", "+str(itemperpage)):
            #for 資料 in library.find("student","1 order by stud_number limit 0, 5"):
            #for 資料 in library.find("student","1 order by stud_number limit 1,10"):
                學號 = 資料.stud_number
                姓名 = 資料.stud_name
                科系 = 資料.school_dept
                專長 = 資料.major
                薪水 = 資料.expt_salary
                #更新連結 = "<a href=\"updateForm?stud_number="+學號+"\">"+學號+"</a>"
                更新連結 = "<a href=\"updateForm?uuid="+str(資料.uuid)+"\">"+學號+"</a>"
                更新 = "<a href=\"updateForm?uuid="+str(資料.uuid)+"\">更新</a>"
                刪除 = "<a href=\"deleteForm?uuid="+str(資料.uuid)+"\">刪除</a>"
                個人資料.append([更新連結,姓名,科系,專長,薪水,更新,刪除])
        #
        # 根據數列中各 tuple 中的學號(亦即 key data[0])進行排序
        # 個人資料排列後, 必須加以指定成變數, 否則個人資料的內容排序後並未改變
        #個人資料 = sorted(個人資料, key=lambda data: data[0], reverse=True)
        個人資料 = sorted(個人資料, key=lambda data: data[int(key_num)], reverse=int(rev_order))
        #print(個人資料)
        #outString = self.htmlList(個人資料)
        outString = self.pageList(個人資料,totalitem,itemperpage,page)
        return outString

    readData.exposed = True
    #@+node:myleobook1.20130228000334.8059: *3* doUpdate
    # 實際執行資料更新的方法
    def doUpdate(self, uuid=None, stud_number=None, stud_name=None, \
                    school_dept=None, major=None, expt_salary=None, itemperpage=9, page=1):
        個人資料 = []
        資料計數 = 0
        # 以下改為以 pybean 儲存資料
        library = Store(SQLiteWriter(SQLite_data_dir+"/database.sqlite", frozen=False))
        # 動態建立 student 資料表
        student = library.new("student")

        # 以 find_one 找出所要更新的一筆資料
        更新資料 = library.find_one("student","uuid=?",[UUID(uuid).bytes])

        # 將更新資料存入 pybean
        更新資料.stud_number = stud_number
        更新資料.stud_name = stud_name
        更新資料.school_dept = school_dept
        更新資料.major = major
        更新資料.expt_salary = expt_salary
        # 儲存資料表內容
        library.save(更新資料)
        # 設法從資料庫中擷取所有資料, 以得到個人資料數列
        for 資料 in library.find("student","1"):
            學號 = 資料.stud_number
            姓名 = 資料.stud_name
            科系 = 資料.school_dept
            專長 = 資料.major
            薪水 = 資料.expt_salary
            更新連結 = "<a href=\"updateForm?uuid="+str(資料.uuid)+"\">"+學號+"</a>"
            # 增加更新與刪除連結
            #個人資料.append([更新連結,姓名,科系,專長,薪水])
            更新 = "<a href=\"updateForm?uuid="+str(資料.uuid)+"\">更新</a>"
            刪除 = "<a href=\"deleteForm?uuid="+str(資料.uuid)+"\">刪除</a>"
            個人資料.append([更新連結,姓名,科系,專長,薪水,更新,刪除])
        #
        # 根據數列中各 tuple 中的學號(亦即 key data[0])進行排序
        # 個人資料排列後, 必須加以指定成變數, 否則個人資料的內容排序後並未改變
        個人資料 = sorted(個人資料, key=lambda data: data[0], reverse=True)
        #print(個人資料)
        # 改用 HTML 進行資料列印
        #outString = self.htmlList(個人資料)
        totalitem = library.count("student")
        outString = self.pageList(個人資料,totalitem,itemperpage,page)
        return outString
    doUpdate.exposed = True
    #@+node:myleobook1.20130228000334.8060: *3* doDelete
    # 實際執行資料刪除的方法
    def doDelete(self, uuid=None, itemperpage=9, page=1):
        個人資料 = []
        資料計數 = 0
        # 以下改為以 pybean 儲存資料
        library = Store(SQLiteWriter(SQLite_data_dir+"/database.sqlite", frozen=False))
        # 動態建立 student 資料表
        student = library.new("student")
        # 以 find_one 找出所要刪除的一筆資料
        刪除資料 = library.find_one("student","uuid=?",[UUID(uuid).bytes])
        # 刪除此筆資料
        library.delete(刪除資料)
        # 設法從資料庫中擷取所有資料, 以得到個人資料數列
        for 資料 in library.find("student","1"):
            學號 = 資料.stud_number
            姓名 = 資料.stud_name
            科系 = 資料.school_dept
            專長 = 資料.major
            薪水 = 資料.expt_salary
            更新連結 = "<a href=\"updateForm?uuid="+str(資料.uuid)+"\">"+學號+"</a>"
            #個人資料.append([更新連結,姓名,科系,專長,薪水])
            更新 = "<a href=\"updateForm?uuid="+str(資料.uuid)+"\">更新</a>"
            刪除 = "<a href=\"deleteForm?uuid="+str(資料.uuid)+"\">刪除</a>"
            個人資料.append([更新連結,姓名,科系,專長,薪水,更新,刪除])
        #
        # 根據數列中各 tuple 中的學號(亦即 key data[0])進行排序
        # 個人資料排列後, 必須加以指定成變數, 否則個人資料的內容排序後並未改變
        個人資料 = sorted(個人資料, key=lambda data: data[0], reverse=True)
        #print(個人資料)
        # 改用 HTML 進行資料列印
        #outString = self.htmlList(個人資料)
        totalitem = library.count("student")
        outString = self.pageList(個人資料,totalitem,itemperpage,page)
        return outString
        # 改為以分頁列表
        
    doDelete.exposed = True
    #@+node:myleobook1.20130228000334.8061: *3* htmllist
    # html 列表, 已經改為分頁列表 pageList 方法
    def htmlList(self, inputList=None):
        htmlcode = HTML.table(inputList)
        htmlcode += self.menuLink()
        return htmlcode
    #@+node:myleobook1.20130228000334.8062: *3* pageList
    def pageList(self, inputList=None, totalitem=0, itemperpage=9, page=1):
        #print(inputList)
        # templates 為相對目錄
        套稿查詢 = TemplateLookup(directories=['templates'])
        # 必須要從 templates 目錄取出 index.html
        頁面列表 = 套稿查詢.get_template("pagelist.html")
        #座位套稿 = Template(filename='templates/index.html', format_exceptions=True, lookup=套稿查詢)
        #return 座位套稿.render(currentTime=datetime.datetime.now())
        # 這裡必須要在 pagelist.html 中設法利用 page_now 與 itemperpage 建立頁面轉換的表單
        # 而 inputList 數列也必須與 page 及 itemperpage 進行互動, 以便送出不同頁面的內容數列
        return 頁面列表.render(st_array=inputList, totalitem=totalitem, itemperpage=itemperpage, page=page)
    #@+node:myleobook1.20130228000334.8063: *3* spageList
    # spageList 為 search 結果的分頁列表方法
    def spageList(self, inputList=None, totalitem=0, itemperpage=9, page=1):
        #print(inputList)
        # templates 為相對目錄
        # 由於為搜尋結果分頁, 因此 inputList 由 search_result session 中取出
        #inputList = cherrypy.session.get('search_result')
        套稿查詢 = TemplateLookup(directories=['templates'])
        # 必須要從 templates 目錄取出 index.html
        搜尋列表 = 套稿查詢.get_template("spagelist.html")
        #座位套稿 = Template(filename='templates/index.html', format_exceptions=True, lookup=套稿查詢)
        #return 座位套稿.render(currentTime=datetime.datetime.now())
        # 這裡必須要在 pagelist.html 中設法利用 page_now 與 itemperpage 建立頁面轉換的表單
        # 而 inputList 數列也必須與 page 及 itemperpage 進行互動, 以便送出不同頁面的內容數列
        return 搜尋列表.render(st_array=inputList, totalitem=totalitem, itemperpage=itemperpage, page=page)
    #@+node:myleobook1.20130228000334.8064: *3* exiting
    # 退出函式
    def exiting(self):
        print("系統即將退出!")
        print("所要終止的 PID 為:"+ str(os.getpid()))
        # 必須要使用 /F forced mode 與 /T tree mode 才能真正 kill pyforum.py 對應的 process
        os.system("taskkill /F /T /PID "+str(os.getpid()))
    exiting.exposed = True
    #@+node:myleobook1.20130228000334.8065: *3* menuLink
    # 連結功能表單
    # 已經改為 Mako based, 應該無需此函式
    def menuLink(self):
        return '''
        <br />
        <a href="index">input</a>|
        <a href="searchForm">關鍵字搜尋</a>|
        <a href="readData">正向排序</a>|
        <a href="readData?rev_order=1">反向排序</a>|
        <a href="readData?rev_order=0&key_num=4">根據薪資正向排序</a>|
        <a href="readData?rev_order=1&key_num=4">根據薪資反向排序</a>|
        <a href="gentable">gentable</a>|
        <a href="cmsinput">cmsinput</a>|
        <a href="exiting">exiting</a>
        <br />
        '''
    #@+node:myleobook1.20130228000334.8066: *3* gentable
    #=========================================================================
    #  以下為產生網路分組連結的方法, 從 2012c1w13.py 改寫為 def gentable()方法
    #=========================================================================

    def gentable(self):
        '''
        2013.01.20 改為 pybean 資料庫存取
        本程式的目的在讀取 401231_out2.txt 學生分組名單, 依據各學員學號姓名以及座號, 建立所需的資料連結表格, 並透過連結允許使用者附加資料.
        '''
        library = Store(SQLiteWriter(SQLite_data_dir+"/student.sqlite", frozen=False))
        grouping = library.new("st908306")
        # 建立一個空數列
        st_array = list()
        # 建立一個空字典
        st_dict = {}
        組別 = 0
        #===============================================================
        #  接著進入程式的第二階段
        #===============================================================
        # 接下來進行上述 st_array 的應用
        # 用來判定表格是否有資料的變數
        有資料 = 0
        # 開始準備列印網際表單
        fileout = open("400232_out_w13.html","w",encoding='utf-8')
        # 列出目前的資料庫中 st908306 資料表的內容
        if (library.count("st908306") == 0):
            outString = "沒有資料, 請先輸入資料!<br />"
            outString += self.menuLink()
            return outString
        else:
            total = library.count("st908306")
        # 這裡有兩種選擇, 從資料庫中弄出與先前相同的 st_array 或者直接由資料庫中查出所要的資料
        # 改為從資料庫中的資料表計算總學員數
        #total = len(st_array)
        # 建立 table 表格
        # 加入超文件標頭
        超文件標頭 = '''
            <html>
            <head>
            <meta http-equiv="content-type" content="text/html;charset=utf-8">
            <title>分組座位表</title>
            </head>
            <body>
            '''
        fileout.write(超文件標頭)
        # 除了寫檔外, 利用 outString 來收集超文件字串, 最後再以 return 傳回
        outString = 超文件標頭
        fileout.write("<center>黑板<br /><br /><table border=1>")
        outString += "<center>黑板<br /><br /><table border=1>"
        #_23_56_89_11,12
        # 因為最多 12 組, 增加的組連結行數共有 3 行
        組加行 = 3
        # 每一列可容納的組數為 3
        每列組數 = 3
        組累計 = 0
        列累計 = 0
        目前組別 = 0
        for 列 in range(1,10+組加行):
            # 希望在第 1, 4 ,7 列加上組別連結
            if 列 in [1, 4, 7, 10]:
                組累計 += 1
                fileout.write("<tr>")
                outString += "<tr>"
                for 行 in range(9,0,-1):
                    # 組別連結將會放在第 2, 5, 8  行的位置, 且各橫跨 3 行
                    if 行 in [2, 5, 8] :
                        列累計 += 1
                        #目前組別 = 列+每列組數*組累計-列累計
                        fileout.write("<td colspan=\"3\" align=\"center\">第"+str(列+每列組數*組累計-列累計)+"組</td>")
                        outString += "<td colspan=\"3\" align=\"center\">第"+str(列+每列組數*組累計-列累計)+"組</td>"
                fileout.write("</tr>")
                outString += "</tr>"
            else:
                # 將組累計數從增加的列數中扣除, 得到在未加上組連結列之前的列序號, 
                列 -= 組累計
                fileout.write("<tr>")
                outString += "<tr>"
                for 行 in range(9,0,-1):
                    # 設法逐一掃過所有資料, 以便找出符合列印行數與列數的資料
                    for 資料 in library.find("st908306","1"):
                        if(資料.col == 行 and 資料.row == 列):
                            fileout.write("<td>"+str(資料.stud_number)+str(資料.stud_name)+"</td>")
                            outString += "<td><a href=index?stud_number="+str(資料.stud_number)+\
                                                "&stud_name="+str(資料.stud_name)+">"+str(資料.stud_number)+\
                                                str(資料.stud_name)+"</a></td>"
                            有資料 = 1
                    if(有資料 == 0):
                        fileout.write("<td>&nbsp;</td>")
                        outString += "<td>&nbsp;</td>"
                    else:
                        有資料 = 0
                fileout.write("</tr>")
                outString += "</tr>"
        fileout.write("</table></center>")
        outString += "</table></center>"
        超文件收尾 = '''
            </body>
            </html>
            '''
        fileout.write(超文件收尾)
        outString += 超文件收尾
        # 最後記得附加連結表單
        outString += self.menuLink()
        # 改為資料庫存取後, 沒有 filein
        #filein.close()
        fileout.close()
        # 將已經拼湊好的 outString 傳回瀏覽器
        return outString
    # 讓 gentable 方法可以直接以 URL 連結呼叫
    gentable.exposed = True
    #@+node:myleobook1.20130228000334.8067: *3* gentable2
    def gentable2(self):
        library = Store(SQLiteWriter(SQLite_data_dir+"/student.sqlite", frozen=False))
        grouping = library.new("st908306")
        # 建立一個空數列
        st_array = list()
        mako_array = list()
        # 資料庫查詢 1 表示全部資料, row 欄位正向排序, col 則逆向排序
        for 資料 in library.find("st908306","1 order by row,col DESC"):
            #print(資料.stud_number,資料.stud_name,資料.row,資料.col)
            mako_array.append("<a href=>"+資料.stud_number+"<br />"+資料.stud_name+"</a>")
        #print(mako_array)
        #套稿查詢 = TemplateLookup(directories=['./templates'], output_encoding='utf-8', encoding_errors='replace')
        # templates 為相對目錄
        套稿查詢 = TemplateLookup(directories=['templates'])
        # 必須要從 templates 目錄取出 index.html
        座位套稿 = 套稿查詢.get_template("gentable.html")
        #座位套稿 = Template(filename='templates/index.html', format_exceptions=True, lookup=套稿查詢)
        #return 座位套稿.render(currentTime=datetime.datetime.now())
        return 座位套稿.render(st_array=mako_array)
        # #############################################
        # 以上使用 Mako 套稿處理頁面, 以下程式段應該不再需要
        # #############################################
        # 建立一個空字典
        st_dict = {}
        組別 = 0
        有資料 = 0
        # 開始準備列印網際表單
        fileout = open("400232_out_w13.html","w",encoding='utf-8')
        # 列出目前的資料庫中 st908306 資料表的內容
        if (library.count("st908306") == 0):
            outString = "沒有資料, 請先輸入資料!<br />"
            outString += self.menuLink()
            return outString
        else:
            total = library.count("st908306")
        超文件標頭 = '''
            <html>
            <head>
            <meta http-equiv="content-type" content="text/html;charset=utf-8">
            <title>分組座位表</title>
            </head>
            <body>
            '''
        fileout.write(超文件標頭)
        # 除了寫檔外, 利用 outString 來收集超文件字串, 最後再以 return 傳回
        outString = 超文件標頭
        fileout.write("<center>黑板<br /><br /><table border=1>")
        outString += "<center>黑板<br /><br /><table border=1>"
        #_23_56_89_11,12
        # 因為最多 12 組, 增加的組連結行數共有 3 行
        組加行 = 3
        # 每一列可容納的組數為 3
        每列組數 = 3
        組累計 = 0
        列累計 = 0
        目前組別 = 0
        for 列 in range(1,10+組加行):
            # 希望在第 1, 4 ,7 列加上組別連結
            if 列 in [1, 4, 7, 10]:
                組累計 += 1
                fileout.write("<tr>")
                outString += "<tr>"
                for 行 in range(9,0,-1):
                    # 組別連結將會放在第 2, 5, 8  行的位置, 且各橫跨 3 行
                    if 行 in [2, 5, 8] :
                        列累計 += 1
                        #目前組別 = 列+每列組數*組累計-列累計
                        fileout.write("<td colspan=\"3\" align=\"center\">第"+str(列+每列組數*組累計-列累計)+"組</td>")
                        outString += "<td colspan=\"3\" align=\"center\">第"+str(列+每列組數*組累計-列累計)+"組</td>"
                fileout.write("</tr>")
                outString += "</tr>"
            else:
                # 將組累計數從增加的列數中扣除, 得到在未加上組連結列之前的列序號, 
                列 -= 組累計
                fileout.write("<tr>")
                outString += "<tr>"
                for 行 in range(9,0,-1):
                    # 設法逐一掃過所有資料, 以便找出符合列印行數與列數的資料
                    for 資料 in library.find("st908306","1"):
                        if(資料.col == 行 and 資料.row == 列):
                            fileout.write("<td>"+str(資料.stud_number)+str(資料.stud_name)+"</td>")
                            outString += "<td><a href=index?stud_number="+str(資料.stud_number)+\
                                                "&stud_name="+str(資料.stud_name)+">"+str(資料.stud_number)+\
                                                str(資料.stud_name)+"</a></td>"
                            有資料 = 1
                    if(有資料 == 0):
                        fileout.write("<td>&nbsp;</td>")
                        outString += "<td>&nbsp;</td>"
                    else:
                        有資料 = 0
                fileout.write("</tr>")
                outString += "</tr>"
        fileout.write("</table></center>")
        outString += "</table></center>"
        超文件收尾 = '''
            </body>
            </html>
            '''
        fileout.write(超文件收尾)
        outString += 超文件收尾
        # 最後記得附加連結表單
        outString += self.menuLink()
        # 改為資料庫存取後, 沒有 filein
        #filein.close()
        fileout.close()
        # 將已經拼湊好的 outString 傳回瀏覽器
        return outString
    # 讓 gentable 方法可以直接以 URL 連結呼叫
    gentable2.exposed = True
    #@-others






    

    



    

    

    



#@-others
#@+<< static config >>
#@+node:myleobook1.20130228000334.8068: ** << static config >> (靜態設定)
# 靜態檔案的目錄對應設定
myconfig = {'/downloads':{
    'tools.staticdir.on': True,
    'tools.staticdir.root': download_root_dir,
    'tools.staticdir.dir': 'downloads',
    'tools.staticdir.index' : 'index.htm'
    },
    # 設定靜態 templates 檔案目錄對應
    '/templates':{
    'tools.staticdir.on': True,
    'tools.staticdir.root': template_root_dir,
    'tools.staticdir.dir': 'templates',
    'tools.staticdir.index' : 'index.htm'
    }
}
#@-<< static config >>
#@+<< run >>
#@+node:myleobook1.20130228000334.8069: ** << run >> (執行設定)
cherrypy.server.socket_port = 8083
cherrypy.server.socket_host = '127.0.0.1'
# 根據 site_config 的設定, 可以分別在 OpenShift 與 local 運行
if site_config == "OpenShift":
    application = cherrypy.Application(個人資料處理(), config=myconfig)
else:
    # 在 local 運行時, 自動啟動 Chrome
    os.system("V:/tools/GoogleChromePortable/GoogleChromePortable.exe http://localhost:8083")
# 啟動時採用 myconfig 的設定
    cherrypy.quickstart(個人資料處理(), config=myconfig)
#@-<< run >>
#@-leo

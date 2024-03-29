#coding: utf-8
'''
最多只能處理 60 名修課學員分組, 分為 10 組
2013.01.19 完成與 Pyforum 的初步整合, 改為 pybean 資料儲存

2012.02.28 完成 spread sheet 與電腦教室格式資料處理 (最早以 Python3 亂數分組後, 產生能夠在 sgw 試算表中使用的資料格式.
分組資料列印格式:
學號 姓名 - 座號: (行, 列)

2012.02.23
針對處理文件的特殊中文字, 無法在 cp950 (Big-5), 轉而以 utf-8 寫成檔案後, 在 utf-8 環境開啟
908306_out.txt 為套用到 spread sheet 上的格式資料
908306_out2.txt 則為以電腦教室座號為參考的格式資料

2012.10.04 完成 超文件表格套用
908306_out.html 為超文件表格
908306_out2.txt 則為分組座次表

from urllib.parse import urlencode
print (urlencode({"search":"中文","folder":"101"}))
urllib.parse.urlencode 僅能處理 dictionary, 例如:{"search":"中文","folder":"101"}
在 sgw 中的目錄搜尋必須使用:bin/index.php?folder=101&view=search&search=中文
'''
# 導入 random 模組

import random
# 導入 Python3 內建的 urllib, 以下可以直接使用 urlencode(), 但是必須輸入 dictionary
from urllib.parse import urlencode
# 用於 pybean 資料儲存
from pybean import Store, SQLiteWriter
from uuid import *

# seat2 則傳回以電腦教室作為行數與列數為基準的座位表
def seat2(group_num):
    count = 0
    column = 0
    row = 0
    seat_array = list()
    # 每組 6 人, 共有 10 組
    for i in range(group_num):
        # 各組前排組員 k=1, 各組後排組員 k=2
        for k in range(1,3):
            for j in range(3):
                count = count + 1
                #print("第",count,"位學生座位編號:",end="")
                if (count%6 == 1 and count != 1):
                    column = column + 3
                #print(j + 1 + column%9,end="")
                if (count%18 == 1 and count != 1):
                    row = row + 2
                #print(",",1 + row)
                # 以下為原先電腦教室的座位表
                #seat_array.append((j + 1 + column%9,k + row))
                seat_array.append((j + 1 + column%9,k + row))
                # 為了轉換成試算表上的座位表, 行數必須用 9 減
                # 而列數則必須減掉 1
                #seat_array.append((9-(j + 1 + column%9),(k + row-1)))
    return seat_array
   
# 以 utf-8 編碼讀檔, 並存入 file 變數
# 之所以寫檔而不直接在 output 區顯示資料, 主要在避開 Python3 會以 os 的中文語系作為輸出依據
# 而在 Windows 中的 cp950 (big-5) 會造成部分中文字無法正確顯示而產生錯誤
# 以下的學生名單與輸出名單, 必須配合各班分組時進行更改
file = open("908306.txt","r",encoding='utf-8')
# 超文件座號表
fileout = open("908306_out.html","w",encoding='utf-8')
# 分組表
fileout2 = open("908306_out2.txt","w",encoding='utf-8')
# 要增加一個以學號排序的分組與座號資料表
fileout3 = open("908306_out3.txt","w",encoding='utf-8')
# 建立一個空數列
st_array = list()
# 建立一個空字典
st_dict = {}
# 建立一個學生分組資料數列, 用來存放學號姓名, 行, 列, 組別
學生分組資料 = []
#{(1,1):"組別 學號 姓名"}
# 起始 st_dict
for 列 in range(1,9):
    for 行 in range(9,0,-1):
        st_dict[(行, 列)] = "&nbsp;"
# 利用 for 迴圈將檔案 file 的內容逐一列出
for line in file:
    # 因為每一行資料以逗點隔開, 並且以\n 跳行結束, 利用 split(), 將資料分別讀出
    #student = line.split(",")
    student = line.split(" ")
    # student 資料列表的第二個元素最後為 \n, 利用 strip() 函式去除
    # 所得到每行讀出的資料中, 第一元素為學號, 第二元素則為學生姓名
    # 利用所讀出的各行資料, 以數列的 append() 函式, 組成數列 st_array
    st_array.append(student)
    #print(st_array)
    #print(student[0],student[1].strip())
# 利用 random 物件中的 shuffle() 函式, 以亂數進行排序
random.seed() 
random.shuffle(st_array)
#print(st_array)
# 利用 len() 求出數列元素個數
total = len(st_array)
# 每組人數設為 num
num = 6
# 辨識組別的變數 order, 由第 1 組開始
order = 1
# 用來計算學生序號的 count 變數
count = 0

# 利用 for 迴圈逐一進行分組資料列印
for i in range(0,total):
    學生分組資料.append(st_array[i][0]+st_array[i][1].strip()+","+str(seat2(10)[i][0])+","+str(seat2(10)[i][1])+","+str(order))
    # 以 pybean 儲存資料, 若非在每次存檔之前都執行下兩行,  資料庫只會儲存最後一筆資料 (會進行資料覆蓋?)
    library = Store(SQLiteWriter("student.sqlite", frozen=False))
    # 動態建立 student 資料表
    grouping = library.new("st908306")
    grouping.stud_number = st_array[i][0]
    grouping.stud_name = st_array[i][1].strip()
    grouping.col= seat2(10)[i][0]
    grouping.row = seat2(10)[i][1]
    grouping.grp = order
    # 儲存資料表內容
    library.save(grouping)
    if(i%num == 0):
        fileout2.write("第"+str(order)+"組:------\n")
    count = count + 1
    # 寫出學號, 姓名
    fileout2.write(st_array[i][0]+st_array[i][1].strip())
    # 寫出座號, seat2 為電腦教室編號, seat 則為 spread sheet 上的編號
    fileout2.write(" - 座號:"+str(seat2(10)[i])+"\n")
    st_dict[seat2(10)[i]] = str(order)+" "+st_array[i][0]+" "+st_array[i][1].strip()
    if((i+1)%(num) == 0):
        order = order + 1
fileout.write("<center>黑板<br /><br /><table border=1>")
for 列 in range(1,9):
    fileout.write("<tr>")
    for 行 in range(9,0,-1):
        if (st_dict[(行,列)] != "&nbsp;"):
            組別學號姓名 = st_dict[(行,列)].split()
            組別 = 組別學號姓名[0]
            學號 = 組別學號姓名[1]
            姓名 = 組別學號姓名[2]
            #fileout.write(st_dict[(行,列)])
            if(int(組別)%2 == 0):
                fileout.write("<td bgcolor=\"#FFCCCC\">")
            else:
                fileout.write("<td bgcolor=\"#CCCCFF\">")
            fileout.write("第"+組別+"組<br />"+學號+"<br />"+姓名)
            fileout.write("</td>")
        else:
            fileout.write("<td>&nbsp;")
            fileout.write("</td>")
    fileout.write("</tr>")
fileout.write("</table></center>")
# 就學生分組資料中的 data[6]+data[7] 學號最後兩碼數字轉為整數作為排序依據
學生分組資料 = sorted(學生分組資料, key=lambda data: int(data[6]+data[7]))
# 將資料寫到 fileout3
for 索引 in range(len(學生分組資料)):
    fileout3.write(學生分組資料[索引]+"\n")
#print(學生分組資料)
# 驗證學生總人數是否吻合
#print("總共有:",total,"名學生")
#fileout.write("\n總共有:"+str(total)+"名學生\n")
file.close()
fileout.close()
fileout2.close()
fileout3.close()
'''
2013 虛設一甲
908306.txt
90830601 饒庭鴻
90830602 伊庭琪
90830603 蔔岳紫
90830604 巢恩思
90830605 管韻綺
90830606 那呈昌
90830607 梅恆佑
90830608 邢欣翰
90830609 危恬生
90830610 董仁珍
90830611 甘軍瑩
90830612 封映花
90830613 空季泉
90830614 陳臻泉
90830615 車裕淳
90830616 華晉登
90830617 曾松昭
90830618 高幸妹
90830619 茅貴小
90830620 郗發財
90830621 廉為偉
90830622 婁豐希
90830623 鈄蓁恭
90830624 索玉榮
90830626 江汝薇
90830627 丁貞天
90830628 倪軒強
90830629 申美成
90830630 岑英峻
90830631 池男尹
90830632 關予必
90830633 暴金奕
90830634 籍意生
90830635 相發延
90830636 伊宣強
90830637 邊皇紫
90830638 雍星凌
90830639 蔚家小
90830640 乜尚雨
90830641 藺鴻能
90830642 馮旺純
90830643 鄒興紋
90830644 胥茹燦
90830645 桂男穎
90830646 趙琬義
90830647 鞠珊聿
90830648 喬辛華
90830649 蒲桂水
90830650 鍾禮青
90830651 嚴定如
90830652 齊喬妃
90830653 師毓青
90830654 施夙盛
90830655 胥璇佑
90830656 單綺昀
90830657 巫夢綺
90830658 安智凌
90830659 崔慧妮
90830660 虞屏冰
90830661 池友揚
'''
// ============================================================
// npc-zh.ts — NPC 中文名對照（手動維護）
//
// 來源資料 ffxivcollect 只有英文名，這裡補中文，供對手牌組面板搜尋與顯示。
// 用法與 cards-zh.ts 相同：填了就用中文，沒填（空字串）就自動退回英文。
// 搜尋兩邊都比對，所以只填一部分也能用。
//
// 鍵是 npc-decks.ts 的 NPC id。行末註解是「英文名 ｜ 打贏後掉落的卡」，
// 卡號用遊戲內的 No.，中文卡名取自 cards-zh.ts（沒對照的仍顯示英文），
// 方便拿掉落卡去中文攻略反查這個 NPC 是誰。
// ============================================================

export const NPC_NAMES_ZH: Record<number, string> = {
  2293874: '', // Aiglephine ｜ 掉落 No.313 巨怪
  2293862: '', // Arsieu ｜ 掉落 No.289 Dawon、No.290 Adrammelech
  2293773: '', // Aurifort of the Three Clubs ｜ 掉落 No.27 美男子布迦加、No.12 古卜
  2293777: '巴德龍', // Baderon ｜ 掉落 No.29 十指巴德龍、No.18 魚人
  2293843: '', // Botan ｜ 掉落 No.217 Louhi、No.225 Pazuzu、No.215 Yukinko、No.216 Happy Bunny
  2293891: '', // Br'uk Noq' ｜ 掉落 No.394 Branchbearer
  2293783: '', // Buscarron ｜ 掉落 No.48 帕帕力莫&伊達、No.44 拉雅·奧·神納&阿·盧恩·神納、No.23 惡魔牆
  2293902: '', // Camalbusert ｜ 掉落 No.443 Rukhkh、No.444 Genie of the Lamp
  2293879: '賽麗亞', // Celia ｜ 掉落 No.323 Fourchenault Leveilleur、No.326 Endwalker Alphinaud & Alisaie
  2293878: '', // Cheatingway ｜ 掉落 No.317 兔兔族、No.318 阿爾戈斯
  2293860: '科布蕾瓦', // Cobleva ｜ 掉落 No.281 Rolling Tankard、No.280 Dwarf
  2293807: '', // Dominiac ｜ 掉落 No.88 Deepeye、No.73 獅鷲
  2293852: '', // Drery ｜ 掉落 No.242 Gigantender、No.240 Evil Weapon
  2293871: '', // Droyn ｜ 掉落 No.300 Azulmagia、No.301 Siegfried
  2293806: '艾蕾茲', // Elaisse ｜ 掉落 No.89 Archaeornis、No.129 Gibrillont
  2293904: '', // Elvaan Red Mage ｜ 掉落 No.457 Promathia
  2293857: '', // Eo Sigun ｜ 掉落 No.262 Nu Mou、No.260 仙子豬
  2293825: '', // Ercanbald ｜ 掉落 No.173 梅·娜格、No.73 獅鷲
  2293770: '', // F'hobhas ｜ 掉落 No.36 繆塔米克斯
  2293823: '', // Flichoirel the Lordling ｜ 掉落 No.154 奈爾·范·達納斯、No.142 蜂鳥
  2293778: '', // Fufulupa ｜ 掉落 No.46 桑克瑞德、No.25 奇美拉
  2293861: '', // Furtive Former Imperial ｜ 掉落 No.285 藍寶石武器
  2293883: '', // Gamingway ｜ 掉落 No.360 Dreamingway
  2293834: '伽利摩', // Garima ｜ 掉落 No.172 Ananta、No.192 Qiqirn Meateater
  2293895: '', // Gavoll Ja ｜ 掉落 No.398 Gulool Ja Ja
  2293792: '', // Gegeruju ｜ 掉落 No.56 敏菲利亞、No.49 雅·修朵拉
  2293880: '伽娑', // Ghasa ｜ 掉落 No.341 Hippo Cart
  2293799: '', // Gibrillont ｜ 掉落 No.75 艾斯蒂尼安
  2293849: '', // Glynard ｜ 掉落 No.239 阿馬羅
  2293856: '', // Grewenn ｜ 掉落 No.256 蘭吉特、No.252 游末邦的小丑
  2293766: '', // Guhtwint of the Three Diamonds ｜ 掉落 No.27 美男子布迦加、No.13 陸行鳥
  2293829: '魚影', // Gyoei ｜ 掉落 No.170 Namazu、No.232 Great Gold Whisker
  2293850: '', // Gyuf Uin ｜ 掉落 No.243 菲奧·烏兒
  2293789: '', // Hab ｜ 掉落 No.62 希爾迪布蘭德&娜修·瑪卡拉卡、No.46 桑克瑞德、No.45 戈德伯特·曼德維爾
  2293842: '', // Hachinan ｜ 掉落 No.222 朝陽·薩斯·布魯圖斯、No.188 芝諾斯·耶·加爾烏斯
  2293824: '', // Hall Overseer ｜ 掉落 No.6 蒂娜·布蘭福德、No.147 魔導巨兵
  2293859: '', // Hanagasa ｜ 掉落 No.233 聖天使阿爾蒂瑪、No.210 鬼龍雅茲瑪特、No.196 冷血劍阿加斯、No.195 人馬王洛弗卡勒
  2293851: '哈格菈', // Hargra ｜ 掉落 No.254 Shadowbringers Y'shtola、No.244 Runar
  2293779: '', // Helmhart ｜ 掉落 No.22 奧爾特羅斯&杜彭、No.34 蓋羅爾特·布拉克索恩
  2293848: '', // Hetsukaze ｜ 掉落 No.236 Ejika Tsunjika、No.226 Penthesilea、No.235 Dvergr、No.237 Provenance Watcher
  2293841: '', // Hokushin ｜ 掉落 No.227 保鑣&大五郎、No.224 機關般惹
  2293816: '', // House Fortemps Manservant ｜ 掉落 No.108 奧諾魯瓦、No.120 阿圖瓦雷爾·德·福爾唐、No.121 艾馬內蘭·德·福爾唐
  2293900: '', // Hume Black Mage ｜ 掉落 No.430 Kam'lanaut
  2293903: '', // Hume Thief ｜ 掉落 No.453 Shantotto the Demon、No.454 Alexander Resurrected
  2293853: '', // Ibenart ｜ 掉落 No.241 采夫婦
  2293803: '', // Idle Imperial ｜ 掉落 No.78 希爾妲、No.106 雷古拉·范·休著斯、No.138 提亞馬特、No.135 博物總管
  2293835: '', // Imperial Deserter ｜ 掉落 No.185 夜露、No.194 芙朵拉·雷姆·盧普斯、No.179 格林瓦特
  2293790: '', // Indolent Imperial ｜ 掉落 No.64 蓋烏斯·范·巴艾薩、No.47 尼祿·托爾·斯卡艾瓦、No.31 莉維亞·薩斯·尤尼烏斯、No.32 里塔提恩·薩斯·阿維納
  2293847: '', // Ironworks Hand ｜ 掉落 No.231 阿爾法、No.223 歐米茄、No.184 神龍
  2293837: '', // Isobe ｜ 掉落 No.199 安居鮟鱇、No.207 翡翠&紅
  2293772: '', // Joellaut ｜ 掉落 No.59 阿爾菲諾&阿莉塞、No.15 鳥人
  2293763: '', // Jonas of the Three Spades ｜ 掉落 No.15 鳥人、No.20 莫古利
  2293827: '海山', // Kaizan ｜ 掉落 No.180 Rasho
  2293839: '', // Kikimo ｜ 掉落 No.206 漢考克
  2293882: '奇爾芙芙', // Kilfufu ｜ 掉落 No.350 Geryon the Steer
  2293786: '', // King Elmer III ｜ 掉落 No.61 巴哈姆特、No.45 戈德伯特·曼德維爾
  2293833: '', // Kiuka ｜ 掉落 No.189 飛燕
  2293814: '克林托塔', // Klynthota ｜ 掉落 No.119 提坦、No.122 贊德、No.127 黑暗之雲、No.137 Unei & Doga
  2293826: '', // Kotokaze ｜ 掉落 No.174 琴風
  2293854: '拉姆林', // Lamlyn ｜ 掉落 No.251 Lyna
  2293785: '', // Landenel ｜ 掉落 No.52 奧汀、No.41 泰坦
  2293808: '', // Laniaitte ｜ 掉落 No.90 猴面雀、No.91 長頸駝
  2293894: '', // Larisa ｜ 掉落 No.397 Outrunner
  2293811: '萊維娜', // Lewena ｜ 掉落 No.6 蒂娜·布蘭福德、No.5 巴茲、No.3 洋蔥騎士
  2293872: '', // Lewto-Sue ｜ 掉落 No.293 琳、No.294 蓋亞
  2293812: '', // Linu Vali ｜ 掉落 No.110 腕龍、No.85 俾斯麥、No.134 招雷巨蛇
  2293892: '', // Luwyawa ｜ 掉落 No.395 Rroneek
  2293887: '', // Maillart ｜ 掉落 No.379 Thaliak、No.380 Llymlaen
  2293764: '', // Maisenta ｜ 掉落 No.16 壞風精靈、No.8 礦爬蟲
  2293898: '瑪勒沃倫特·威塞爾', // Malevolent Weasel ｜ 掉落 No.422 Ollier
  2293800: '', // Marcechamp ｜ 掉落 No.77 伊塞勒
  2293782: '', // Marcette ｜ 掉落 No.42 迦樓羅、No.35 弗里克希奧
  2293801: '', // Marielle ｜ 掉落 No.80 艾德蒙·德·福爾唐、No.130 拉妮艾特·德·艾因哈特
  2293836: '正土', // Masatsuchi ｜ 掉落 No.198 Koja、No.205 Lupin
  2293817: '團長莫古京', // Master Mogzin ｜ 掉落 No.140 赫拉斯瓦爾格、No.133 Kal Myhk、No.43 善王莫古爾·莫古XII世、No.111 Darkscale
  2293877: '', // Mehryde ｜ 掉落 No.316 Arkasodara
  2293762: '', // Memeroon ｜ 掉落 No.37 梅梅盧恩、No.14 蜥蜴人、No.2 提燈怪、No.115 光鱗兄弟莫拉加加
  2293845: '', // Mero Roggo ｜ 掉落 No.234 阿爾菲諾&阿莉塞（紅蓮）、No.81 比布羅斯、No.148 博學林鴞、No.117 卡爾克布莉娜
  2293802: '米德奈特·迪尤', // Midnight Dew ｜ 掉落 No.79 Matoya、No.98 Belladonna
  2293897: '', // Miitso ｜ 掉落 No.415 Ark Angel HM、No.416 Ark Angel EV
  2293776: '', // Mimidoa ｜ 掉落 No.33 畢格斯&威吉、No.21 賽蓮
  2293804: '', // Mogmill ｜ 掉落 No.69 瓦努族、No.70 骨頜族、No.102 莫古靈、No.95 維茲爾弗尼爾
  2293769: '', // Momodi ｜ 掉落 No.28 莫莫蒂·莫蒂
  2293819: '', // Mordyn ｜ 掉落 No.65 梅爾維布·布魯菲斯維因、No.132 卡爾瓦蘭·德·戈爾加涅、No.113 克拉肯
  2293767: '', // Mother Miounne ｜ 掉落 No.30 繆恩、No.12 古卜
  2293832: '', // Munglig ｜ 掉落 No.183 紗都、No.175 長毛象
  2293822: '', // Nell Half-full ｜ 掉落 No.151 直爽的三兄弟
  2293830: '尼堅', // Nigen ｜ 掉落 No.181 Cirina、No.175 長毛象
  2293795: '', // Noes ｜ 掉落 No.68 風箏貓、No.118 基路伯
  2293888: '', // Nyikweni ｜ 掉落 No.391 Pelupelu
  2293818: '', // O'kalkaya ｜ 掉落 No.65 梅爾維布·布魯菲斯維因、No.131 羅絲溫、No.136 大海盜霧鬚王
  2293831: '窩哥台', // Ogodei ｜ 掉落 No.182 Magnai、No.175 長毛象
  2293780: '', // Ourdilic ｜ 掉落 No.38 凶惡巨獸、No.26 藍龍、No.11 惡精靈
  2293896: '', // Pawkukwe ｜ 掉落 No.413 Ark Angel TT、No.414 Ark Angel GK
  2293774: '', // Piralnaut ｜ 掉落 No.35 弗里克希奧、No.24 魅魔
  2293821: '', // Prideful Stag ｜ 掉落 No.145 迷途羔羊
  2293881: '', // Prudence ｜ 掉落 No.335 Azeyma、No.334 Rhalgr
  2293899: '', // Pudeel Ja ｜ 掉落 No.427 Wivre、No.428 Doppro
  2293875: '', // Qetanur ｜ 掉落 No.314 畢舍遮
  2293793: '', // R'ashaht Rhiki ｜ 掉落 No.65 梅爾維布·布魯菲斯維因、No.54 利維坦、No.49 雅·修朵拉
  2293858: '', // Redard ｜ 掉落 No.272 大腳野蝠、No.270 奇塔利
  2293844: '', // Redbill Storeboy ｜ 掉落 No.99 艾奇德娜、No.139 卡洛菲斯提莉、No.164 虛空迪亞布羅斯、No.116 弗迪亞
  2293765: '', // Roger ｜ 掉落 No.9 毛爾波爾、No.5 布丁
  2293791: '', // Rowena ｜ 掉落 No.60 路易索瓦·萊維耶勒爾、No.34 蓋羅爾特·布拉克索恩
  2293781: '', // Ruhtwyda of the Three Hearts ｜ 掉落 No.45 戈德伯特·曼德維爾、No.50 尤里安傑·奧居雷
  2293884: '', // Ruissenaud ｜ 掉落 No.365 Proto-Carbuncle、No.366 Themis
  2293855: '', // Saushs Koal ｜ 掉落 No.245 Grenoldt
  2293810: '', // Seika ｜ 掉落 No.93 爬蟲、No.94 智蛙、No.104 朗德洛克斯
  2293784: '', // Sezul Totoloc ｜ 掉落 No.58 希德·加隆德、No.38 凶惡巨獸、No.33 畢格斯&威吉、No.149 晴天霹靂托左爾·法托特爾
  2293873: '', // Sladkey ｜ 掉落 No.310 4th-make Shemhazai、No.311 4th-make Cuchulainn
  2293788: '', // Swift ｜ 掉落 No.67 勞班·阿爾丁、No.59 阿爾菲諾&阿莉塞、No.40 伊弗利特、No.100 皮平·塔魯平
  2293815: '塔普克里克斯', // Tapklix ｜ 掉落 No.123 Brute Justice、No.104 朗德洛克斯、No.150 Alexander Prime
  2293885: '時守', // Tokimori ｜ 掉落 No.369 Okuri Chochin
  2293901: '', // Tokorzur ｜ 掉落 No.435 Rorrlo Teh
  2293775: '', // Trachtoum ｜ 掉落 No.41 泰坦、No.20 莫古利
  2293771: '', // Triple Triad Master ｜ 掉落 No.4 魔石精
  2293828: '葛籠', // Tsuzura ｜ 掉落 No.171 Kojin
  2293893: '', // Uataaye ｜ 掉落 No.396 Sentry R8
  2293840: '', // Umber Torrent ｜ 掉落 No.204 阿雷恩瓦爾德·倫提努斯、No.176 弗巴德
  2293846: '潮木', // Ushiogi ｜ 掉落 No.214 蛭子、No.213 Hatamoto、No.212 輪入道&片輪車
  2293813: '', // Vath Deftarm ｜ 掉落 No.84 羅波那、No.72 胖陸行鳥、No.96 夸爾女王
  2293809: '', // Voracious Vath ｜ 掉落 No.92 邦達斯那奇、No.96 夸爾女王
  2293787: '', // Vorsaile Heuloix ｜ 掉落 No.66 嘉恩·艾·神納、No.53 拉姆、No.48 帕帕力莫&伊達、No.43 善王莫古爾·莫古XII世
  2293890: '', // Warsowok ｜ 掉落 No.393 Moblin
  2293797: '', // Wawalago ｜ 掉落 No.76 露琪亞
  2293889: '', // Wopli ｜ 掉落 No.392 Alpaca
  2293876: '', // Worldly Imperial ｜ 掉落 No.325 昆圖斯·范·秦納
  2293768: '', // Wymond ｜ 掉落 No.8 礦爬蟲、No.128 羅羅力特·納納力特
  2293820: '', // Wyra “Greenhands” Lyehga ｜ 掉落 No.141 碧企鵝
  2293905: '', // Xiisal Ja ｜ 掉落 No.460 Tiisol Ja
  2293798: '', // Yayake ｜ 掉落 No.83 艾默里克、No.114 審理神代言者
  2293796: '', // Yellow Moon ｜ 掉落 No.71 霧中行者夕霧
  2293886: '', // Ylaire ｜ 掉落 No.375 Nophica、No.376 Althyk、No.377 Nymeia
  2293838: '', // Yusui ｜ 掉落 No.201 湛水
}

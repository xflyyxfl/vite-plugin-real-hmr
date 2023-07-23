/***************************************************
* Created Date:2023-07-23 13:52:42
* Author: xflyyxfl@qq.com
* File:index.js
* Function:Detect real js/css file change and then emit HMR for vite
* Copyright (c) 2023 PEIYUN
****************************************************/
const isJsApp = (code,id)=>{
    const info = {res:false,index:undefined,appName:undefined,exportStr:undefined,file:undefined};
    const [filename,query] = id.split('?',2);
    if(!filename.endsWith('.js'))return info;
    info.file = filename;
    const jsAppReg = /(export\s+default)\s+{\s+name:[`'"](.*)[`'"],\s+template/g;
    const match = jsAppReg.exec(code);
    if(!match)return info;
    info.res = true;
    info.index = match.index;
    info.appName = match[2];
    info.exportStr = match[1]; //用于替换
    return info;
};
let jsAppCnt = 0;
const hmrIdMap = new Map();
const getHMRId = id => {
    let res = hmrIdMap.get(id);
    if(!res){
        res = `__${jsAppCnt++}_hmrId`;
        hmrIdMap.set(id,res);
    }
   return  res;
}

const transofrm_code = (code,info,id,opt={})=>{
    const hmrId = getHMRId(info.file);
    code = code.replace(info.exportStr,`const _sfc_main_ = `);

    code = code + `
//**** xfl transform jsApp and add HMR hot handler ****/
export default _sfc_main_;
import {get_compile} from "${virtual_mod}";

_sfc_main_.__hmrId = "${hmrId}";
// _sfc_main_.__file = "${id}";
typeof __VUE_HMR_RUNTIME__ !== 'undefined' && __VUE_HMR_RUNTIME__.createRecord(_sfc_main_.__hmrId, _sfc_main_);
import.meta.hot.accept(async(mod) => {
        if (!mod) return;
        console.log('hote recived',_sfc_main_,mod) //xfl add it 
        const { default: updated, _rerender_only } = mod;
        let all_update = updated.template === _sfc_main_.template;
        if (!all_update ) {
            console.log('just template change');
            const compile = await get_compile();
           __VUE_HMR_RUNTIME__.rerender(updated.__hmrId, compile(updated.template));
        } else {
            __VUE_HMR_RUNTIME__.reload(updated.__hmrId, updated);
        }
})
`;

    return code;

};
const asleep = function(t){
    return new Promise((resolve,reject)=>{
        setTimeout(()=>resolve(t),t);
     })
};
const file_equal = (s1,s2)=>{
    return s1.replaceAll('/','').replaceAll('\\','').toLowerCase() === s2.replaceAll('/','').replaceAll('\\','').toLowerCase()
};
const content_deal = (s)=>{
    let res = [];
    //1 按模板字符串拆分
    let arr = s.split('`');
    arr.forEach((v,idx,arr)=>{
        if(!(idx&1)){//奇数行 偶数索引 为非模板字符串内容
            v = v.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '');//去除注释
            let v_arr = v.split('\n'); // 分割
            v_arr.forEach((row,idx2)=>{
                let trim_row = row.trim();//.replaceAll(/\s+/g,' '); //只保留一个空格,现要保留字串中的空格
                if(trim_row){
                    //保留js语句的字符串的空格
                    const str_value_arr = trim_row.match(/(['"`])(.*?)\1/g);
                    if(str_value_arr){
                        //按照子字符串分割语句
                        let row_arr = trim_row.split(new RegExp(str_value_arr.join('|'),'g'));
                        row_arr = row_arr.map(v=>v.replaceAll(/\s+/g,' '));
                        //拼接回来
                        trim_row = row_arr.map((s,idx)=>`${s} ${str_value_arr[idx]??''}`).join('');
                    }else{
                        trim_row = trim_row.replaceAll(/\s+/g,' ');
                    }

                    
                    if(idx>0 && idx2==0){
                        res[res.length-1] += ('`;'+trim_row); //加回模板
                    }else{
                        res.push(trim_row);
                    }
                }
            })
        }else{//模板字符串的开始
            res[res.length-1] += ('`'+v); //与前行相接
        }
    });
    return res.join('\n');
}
const test = (s)=>{
    let res = [];
    //1 按模板字符串拆分
    let arr = s.split('`');
    arr.forEach((v,idx,arr)=>{
        if(!(idx&1)){//奇数行 偶数索引 为非模板字符串内容
            v = v.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '');//去除注释
            let v_arr = v.split('\n'); // 分割
            v_arr.forEach((row)=>{
                let trim_row = row.trim().replaceAll(/\s+/g,' '); //只保留一个空格
                if(trim_row){
                    res.push(trim_row);
                }
            })
        }else{
            res[res.length-1] += v; //与前行相接
        }
    });
    return res.join('\n');
};

const virtual_mod = 'virtual:xfl-tool-function';
const resolve_virtual_mod = '\0'+virtual_mod;//避免其它插件尝试处理这个模块，scourcemap会依赖这一特点区分虚拟模块与正常模块
const virtual_mod_content  = /*js*/`
    export const get_compile= async()=>{
        if (typeof Vue !== 'undefined')return Vue.compile; 
        const { compile } = await import('vue');
        return compile 
    }
`;

const file_content_cache = {};
const jsAppPlugin = ()=>{
    let config,vscode_change_info;
    let isDev = true;


    return {
        name:'jsApp',
        handleHotUpdate:async(ctx)=>{
            // await asleep(50);//等待change marker保存信息 用于比对是否是外部的
            const {file} = ctx;
            if(!['js','JS','css','change-marker'].includes(file.split('.').at(-1)))return undefined;//直接热更新处理
            if(file.endsWith('.change-marker')){
                console.log('change marker ');//,await ctx.read());
                ctx.read().then(data=>{
                    vscode_change_info=JSON.parse(data);
                    console.log('vscode_change_info:',Object.keys(vscode_change_info).length);
                });
                return []
            };
            console.log(`handelHotUpdate ==》`,file);

            //判断是否真的有修改
            const file_content = content_deal(await ctx.read());//文本处理
            if(file_content_cache[file]){//比较是否真的改变了
                if(file_content_cache[file]=== file_content){
                    console.log(`${file} not really change? ignore HMR`);
                    return [];
                }
            };
            file_content_cache[file] = file_content;

            //判断修改是否来自vscode 从change-marker中读取
            let upt_time = new Date();
            if(vscode_change_info){
                await asleep(100);//等待vscode的保存事件把信息写.change-marker文件
                let chg_time;
                for(let key in vscode_change_info){
                    if(file_equal(key,file)){
                        chg_time = new Date(vscode_change_info[key]);                       
                        if(Math.abs(chg_time - upt_time)>1000){
                            console.log(`file change not from vscode,ignore it,time diff ${chg_time - upt_time}`);
                            return [];
                        }
                    }
                };
                
                if(!chg_time){
                    console.log(`${file} change not from vscode? ignore HMR `);
                    return []; //没有被vscode记录的，不更新
                }
            };
            console.log('HMR send')
            // if(vscode_change_info[ctx.file]){
            //     console.log('get file');
            // }
            
            // return [];//不传递热更新事件
        },
        config(config){
        
        },
        configResolved(_config){
            config = _config;
            isDev = config.mode === 'development';
        },
        configureServer({watcher,env}){
            // 监听文件变化
            // watcher.on('change', (filePath) => {
            //     console.log('watcher file chage',filePath)
            //     // 判断文件路径，如果是需要取消热更新的文件
            //     if (filePath === '/path/to/your/file.js') {
            //     // 取消热更新
            //         watcher.invalidate(filePath)
            //     }
            // })
        },
        buildStart(){
            console.log('build start');
        },
        async resolveId(id){
            // console.log(`resolveId id`,id);
            if(id === virtual_mod)return resolve_virtual_mod;
        },
        load(id,opt){
            // console.log('load id',id,'opt',JSON.stringify(opt))
            if(id === resolve_virtual_mod)return virtual_mod_content;
        },
        transform(code,id,opt){
            const info = isJsApp(code,id);
            if(info.res && isDev){
                console.log('transform ',id,'opt',JSON.stringify(opt),'isJsApp',info.res);
                return transofrm_code(code,info,id,opt)
            }
        }

    }


}
export { jsAppPlugin as default };
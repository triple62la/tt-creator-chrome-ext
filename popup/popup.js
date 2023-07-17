"use strict";

const createBtn = {
    node: document.querySelector(".c_create-ticket__button"),
    set disabled(value){
        appStorage.setParameter("c_create-ticket__button", value)
        this.node.disabled = value
    }
}
const solutionBtn = {
    node: document.querySelector(".c_solution__finish-btn"),
    set disabled(value){
        appStorage.setParameter("c_solution__finish-btn", value)
        this.node.disabled = value
    }
}
const resetBtn = {
    node: document.querySelector(".c_results__reset-btn"),
    set disabled(value){
        appStorage.setParameter("c_results__reset-btn", value);
        this.node.disabled = value
    }
}

function sendToPage(message, responseCallback, callbackArgs){

    chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, message, function (response) {
            if (responseCallback) responseCallback(callbackArgs)
        });
    })
}


class Model {

    async addNewTemplate(template) {       //template = {tmpId: tmpName}
        let result = await chrome.storage.local.get(null)
        const updated = Object.assign(result.templates || {}, template); // если в сторе нет сохраненных
        // темпов тогда берем пустой обьект и кладем туда template
        return await chrome.storage.local.set({templates: updated});
    }

    async getTemplateName(tmpID) {
        let result = await chrome.storage.local.get(null)
        return result.templates[tmpID]
    }

}


class Presenter {
    constructor() {
        this.view = new View();
        this.model = new Model();
        this.connectListeners();
        // this.dataListOnloadUpdate();
    }

    async connectListeners() {
        this.view.delayInput.node.addEventListener("click", (e) => {
            e.target.value = "";
        })
        const inputs = document.querySelectorAll("input");
            for(let el of inputs) {
                el.addEventListener("change", (evnt)=>{
                    appStorage.setParameter(evnt.currentTarget.classList[0], evnt.currentTarget.value)
            })
            } // кратко здесь происходит следующее: берем все инпуты -> навешиваем слушатели(когда юзер изменяет
        // поле ввода) - оно сохраняется в сторедж

    };

    async loadGuiStatement(){

        const storageObj= await appStorage.getAllParams();
        this.view.renderFieldValues(storageObj);
        this.view.rederBtnsStatement(storageObj.status);

    }
    dataListOnloadUpdate() {
        chrome.storage.local.get(null).then((result) => { //get(null) заберет все данные из стораджа
            for (let [tempId, tmpName] of Object.entries(result.templates || {})) {
                const option = this.view.templateDatalist.addTemplate(tempId);
                option.addEventListener("click", () => {
                    this.view.templateName.text = tmpName;
                })

            }
        })
    }
}


class AppStorage {
    setParameter(paramName, value) {
        const obj = {};
        obj[paramName]=value;
        chrome.storage.local.set(obj);
    }

    async getParameter(paramName) {
        const allStorage = await chrome.storage.local.get(null);
        return allStorage[paramName] ?? ""
    }

    async getAllParams() {

        return await chrome.storage.local.get(null);
    }
}

const appStorage = new AppStorage();


class View {
    constructor() {
        this.templateName = {
            node: document.querySelector(".c_template__name"),
            get text() {
                return this.node.value
            },
            set text(value) {
                this.node.value = value
            }
        };
        this.template = {
            node: document.querySelector(".c_template__input"),
            get text() {
                return this.node.value
            },
            set text(value) {
                this.node.value = value
            }
        };
        this.saveTemplateBtn = {
            node: document.querySelector(".c_template__save-btn"),
        };
        this.damageType = {};
        this.templateDatalist = {
            node: document.getElementById("templates"),
            addTemplate(tmplateId) {
                const option = document.createElement("option");
                option.value = tmplateId;
                this.node.appendChild(option);
                return option
            }
        }
        this.delayInput = {
            node: document.querySelector("#delay-input"),
        }

        this.delayDataList = {
            node: document.querySelector("#delay-list"),

        }
    }
    renderFieldValues(inputValues){ // на вход обьект с классами полей и значениями из storage

       for (let [className, value] of Object.entries(inputValues)) {
            if (className.startsWith("c_")){
                document.querySelector("." + className).value = value;
            }
       }
    }
     rederBtnsStatement(status){
         // "started": "Выполняется",
         //     "created": "Создан тикет",
         //     "waiting": "Ожидание решения",
         //     "solution": "Закрытие тикета",
         //     "success": "Успешно",
         //     "failed": "Неуспешно",
         //     "error": "Ошибка",
         //     "cancelled": "Отменено вами"
        switch (status){
            case "started":
            case "created":
                createBtn.disabled = true;
                solutionBtn.disabled =true;
                resetBtn.disabled = true;
                break
            case "waiting":
                createBtn.disabled = true;
                solutionBtn.disabled =false;
                resetBtn.disabled = false
                break
            case "solution":
            case "timer":
                createBtn.disabled = true;
                solutionBtn.disabled =true;
                resetBtn.disabled = false
                break
            case "success":
            case "failed":
            case "error":
            case "cancelled":
                createBtn.disabled = false;
                solutionBtn.disabled =false;
                resetBtn.disabled = true;
        }
    }
    clearCommentInput(){
        document.querySelector(".c_comment__input").value = ""
        appStorage.setParameter("c_comment__input", "")
    }
}



const collectInputValues = () =>{
    const template = document.querySelector(".c_template__input").value;
    const comment = document.querySelector(".c_comment__input").value;
    const delay = document.getElementById("delay-input").value
    const damageTypeValue = document.querySelector("#damage-types").value // здесь номера

   return {template, comment, delay, damageTypeValue}
}




createBtn.node.addEventListener("click", () => {
    const data = collectInputValues();
    if (!data.comment || !data.template){
        alert("Не все поля заполнены")
        return
    }
    chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
            message: "createBtnClick",
            data
        }, function (response) {
        });
    });
    solutionBtn.disabled = true;
});
solutionBtn.node.addEventListener("click", () => {
    const data = collectInputValues();
    if (!data.comment || !data.template){
        alert("Не все поля заполнены")
        return
    }
    createBtn.disabled = true;
    solutionBtn.disabled = true
    chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
            message: "submitBtnClick",
            data
        }, function (response) {
        });
    });
})

resetBtn.node.addEventListener("click", ()=>{

    sendToPage({message:"resetBtnClick"})
    pres.view.clearCommentInput()


})

chrome.storage.onChanged.addListener((changes, namespace) => {
    for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
        if (key === "status") pres.view.rederBtnsStatement(newValue)
        if (key === "status" && ["error", "success", "failed"].includes(newValue)) pres.view.clearCommentInput()
    }
})

const pres = new Presenter();

document.addEventListener("DOMContentLoaded",()=>{
    sendToPage({message:"widgetOpened"})
    pres.loadGuiStatement();
})
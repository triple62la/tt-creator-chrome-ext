"use strict";


const DAMAGE_TYPES = {
    "1": {"damageTypeId": 1136, "zoneOfResponsibilityId": 1010},
    "2": {"damageTypeId": 1624, "zoneOfResponsibilityId": 1010},
    "3": {"damageTypeId": 1137, "zoneOfResponsibilityId": 1010},
    "4": {"damageTypeId": 1146, "zoneOfResponsibilityId": 1002}
};

const ZONE_RESPONSIBILITY = {1010: "Ростелеком ДЭФИР", 1002: "Клиент"};

const localization = {
    "started": "Выполняется",
    "created": "Создан тикет",
    "waiting": "Ожидание решения",
    "timer": "Ожидание таймера",
    "solution": "Закрытие тикета",
    "success": "Успешно",
    "failed": "Неуспешно",
    "error": "Ошибка",
    "cancelled": "Отменено вами",
}
const taskIsFinished = async () => {
    const status = await currentState.status
    return ["success", "failed", "error", "cancelled"].includes(status)
}

let TOKEN = updateToken()

let currentState = {};
let stopFlag = false;

function updateToken(){
    return localStorage.getItem("TTMDEV-token").replaceAll('"', '');
}


currentState = new Proxy(currentState, {
    get(target, p, receiver) {
        return (async () => await chrome.storage.local.get(p))().then(result=>result[p])
    },
    set(target, p, value, receiver) {
        target[p] = value;
        const obj = {};
        obj[p]=value;
        renderState(p, value).then(()=>(async ()=> await chrome.storage.local.set(obj))());
        return true
    }
})

const renderState = async (stateName, value) => {

    switch (stateName){
        case "status":
            const translate = localization[value] ?? ""
            const currTaskIsFinished = await taskIsFinished()
            if (!translate || (value ==="cancelled" && currTaskIsFinished) ){
                return
            }
            else if (value ==="cancelled"){
                currentState.c_comment__input = ""
            }
            else if (currTaskIsFinished){
                currentState.c_comment__input = ""
            }
            panelView.statusText = translate;
            break;
        case "ticketNumber":
            panelView.ticketNumber = value

    }
}


const htmlDialog = ``;

//HTML код блока отображения статуса задачи
const insertElems = `<p class="timer">
        <span class="timer__minutes">00</span>
        :
        <span class="timer__seconds">00</span>
    </p>
    <p class="status__ticket"> Тикет №
        <span class="status__ticket-number"></span>
    </p>
    <div class="status__lamp-panel">
        <div class="status__progress-lamp"></div>
        <div class="status__progress-lamp"></div>
        <div class="status__progress-lamp"></div>
        <div class="status__progress-lamp"></div>
        <div class="status__progress-lamp"></div>
    </div>
    <p class="status__progress-message">Ожидание</p>`




async function request(method, route, payload) {
    const init = {
        method,
        headers: {
            Authorization: `Bearer ${TOKEN}`,
            "Content-Type": 'application/json;charset=utf-8'
        },
        body: JSON.stringify(payload)
    }
    if (method.toLowerCase() === "get") {
        delete init.body
    }
    const response = await fetch(window.location.origin + "/" + route, init);
    const status = response.status
    if (!response.ok) {
        throw new Error(`TTCreator: "Response status from ${route} is ${status}"`)
    }
    return await response.json()
}

async function copyTemplate(tempId) {

    return await request("POST",
        "nttm-web-gateway/api/client-tickets/copy",
        {"sourceTicketId": tempId, "step": 4}); //ticket
}

async function patchCopied(copiedTicket) {

    const route = `nttm-web-gateway/api/client-tickets/${copiedTicket.id}`
    return await request("PATCH", route, copiedTicket)
}

const lastTaskId = (ticket) => ticket.tasks?.at(-1).id;


async function requestTaskId(ticketID) {
    const ticket = await request("GET", `nttm-web-gateway/api/ticket/with-ola/${ticketID}`);
    return ticket.tasks?.at(-1).id
}

function diagClosePayload(comment, ruleId){
    return  {
        "closeComment": `<p>${comment}</p>`,
        "closeGroupArr": [
            {
                "ruleId": ruleId,
                "unitId": 10003,
                "damageLevel": null
            }
        ],
    }
}
function diagClosePayload_v2(comment, ruleId){
    return  {
        "closeComment": `<p>${comment}</p>`,
        "closeGroupArr": [
            {
                "ruleId": ruleId,
                "unitId": 10003,
                "damageLevel": null
            }
        ],
    }
}

async function closeCopied(comment, ticket) {
    const taskId = lastTaskId(ticket)
    return await request("PUT",
        `nttm-web-gateway/api/task/${taskId}/close`,
        diagClosePayload_v2(comment,2405))

}
async function closeCopied_v2(comment, ticket) {
    const taskId = lastTaskId(ticket)
    return await request("PUT",
        `nttm-web-gateway/api/task/${ticket.id}/${taskId}/close`,
        diagClosePayload_v2(comment,2405))

}

async function diagnosticsClose(comment, taskID, ruleId, unitId){

    return await request("PUT", `nttm-web-gateway/api/task/${taskID}/close`,
        diagClosePayload_v2(comment,ruleId, unitId ))
}
async function diagnosticsClose_v2(comment,ticketID, taskID, ruleId, unitId){

    return await request("PUT", `nttm-web-gateway/api/task/${ticketID}/${taskID}/close`,
        diagClosePayload_v2(comment,ruleId, unitId ))
}

async function assign(ticketID) {
    const taskID = await requestTaskId(ticketID)
    return await request("POST", `nttm-task-handler/api/tasks/${ticketID}/${taskID}/assign`, null)
}

async function solutionClose(comment, damageTypeValue,ticketID, taskId){

    const ruleId = window.location.hostname ==='10.28.97.112'? 14663: 35464 //тест и прод
    const {damageTypeId, zoneOfResponsibilityId} = DAMAGE_TYPES[damageTypeValue]
    const payload = {
         "closeComment": `<p>${comment}</p>`,
         "stopDate": new Date().toISOString(), //"%Y-%m-%dT%H:%M:%S"
         damageTypeId , // /nttm-web-gateway/api/client-tickets/227063/damage_types?zoneOfResponsibilityId=1010&onlyInTasks=false
         zoneOfResponsibilityId ,
         "closeGroupArr": [
            {
                ruleId, // Продакшн 35464 http://10.28.97.112/nttm-task-handler/api/tasks/2167948/rules
                "unitId": 10003, // ДЭФИР ЛЦК Wi-Fi Hotspot
                "damageLevel": null
            }
        ],

     }
    return await request("PUT", `nttm-web-gateway/api/task/${ticketID}/${taskId}/close`, payload)
}

async function confirmClose(comment,ticketID, taskId){
    const payload = {
        "closeComment": `<p>${comment}</p>`,
        "closeGroupArr": [
            {
                "ruleId": 2506,
                "unitId": 205,
                "damageLevel": null
            }
        ],
    }
    return await request("PUT", `nttm-web-gateway/api/task/${ticketID}/${taskId}/close`, payload)
}

async function createTicket(comment, template) {
    try {
        currentState.status = "started";
        let ticket = await copyTemplate(template);
        panelView.progresBar.increase("success")
        currentState.ticketNumber = ticket.id;
        currentState.status = "created";
        ticket = await patchCopied(ticket);
        await closeCopied_v2(comment, ticket);
        panelView.progresBar.increase("success")
        let task =  await assign(ticket.id);
        await diagnosticsClose_v2(comment,ticket.id, task.id , 14525, 10003); // в ТТМ две диагностики
        task = await assign(ticket.id);
        await diagnosticsClose_v2(comment,ticket.id, task.id, 15317, 10003);  // в ТТМ две диагностики
        task = await assign(ticket.id);
        currentState.status = "waiting";
        panelView.progresBar.increase("success")
        currentState.task = task
        currentState.ticket = ticket
    }
    catch (e){
        panelView.progresBar.increase("failed");
        currentState.status = "error";
        stopFlag=true
        alert(`TTCreator: createTicket Error: ${e}`)
    }
}


async function closeTicket(comment, damageTypeValue){
    try {
        if (stopFlag){
            stopFlag=!stopFlag
            return
        }
        let task = await currentState.task
        let ticket = await currentState.ticket
        await solutionClose(comment, damageTypeValue, ticket.id,task.id)
        currentState.status="solution"
        panelView.progresBar.increase("success");
        task = await assign(ticket.id)
        await confirmClose(comment,ticket.id ,task.id)
        panelView.progresBar.increase("success");
        currentState.status="success"
    }
    catch (e){
        panelView.progresBar.increase("failed");
        currentState.status = "error";
        stopFlag = true;
        alert(`TTCreator: closeTicket Error: ${e}`)
    }
}

const showResultPanel = async () => {
    TOKEN = updateToken()
    if (!document.querySelector(".status__progress-lamp")) { // проверка на то что панель уже добавлена
        const div = document.createElement("div");
        div.classList.add("replaced-container");
        div.innerHTML += insertElems;
        const logo = document.querySelector(".rt-logo");
        const logoParent = logo.parentNode;
        logoParent.parentNode.replaceChild(div, logoParent);
        div.addEventListener("click", ()=>window.location.href = "#/")
        await restoreGuiStatement()
    }
};


class BtnHandlers {

    async createBtnClick(request) {
        try {
            const comment = request.data.comment
            const template = request.data.template
            if (this.isEmpty(comment, template)) return
            panelView.resetInterface();
            return await createTicket(comment, template)
        }
        catch(e){
            stopFlag = true;
            alert(e)
            currentState.status="error"
            panelView.progresBar.increase("failed")
        }
    }

     async submitBtnClick(request) {
         const comment = request.data.comment
         const template = request.data.template
         if (this.isEmpty(comment, template))  return
         let minutes = parseInt(request.data.delay);
        minutes = isNaN(minutes) ? 0 : minutes
        const countdown = new Countdown(minutes, 0, panel);
        const status = await currentState.status;
        try {
            if (status === "waiting") {
                await countdown.start(() => closeTicket(request.data.comment, request.data.damageTypeValue))
                return
            }
            await this.createBtnClick(request)
            await countdown.start(() => {
                    closeTicket(request.data.comment, request.data.damageTypeValue)
                })
        }
        catch(e){
            stopFlag = true;
            alert(e)
            currentState.status="error"
            panelView.progresBar.increase("failed")
        }
    }

    async resetBtnClick(){
        // "started": "Выполняется",
        //     "created": "Создан тикет",
        //     "waiting": "Ожидание решения",
        //     "timer": "Ожидание таймера",
        //     "solution": "Закрытие тикета",
        //     "success": "Успешно",
        //     "failed": "Неуспешно",
        //     "error": "Ошибка",
        //     "cancelled": "Отменено вами",

        const status = await currentState.status
        switch (status) {
            case "started":
            case "created":
                stopFlag = true;
                break
            case "solution":
                alert("Действие не может быть отменено")
                break
            case "success":
            case "failed":
            case "error":
            case "cancelled":
                break
            case "timer":
                currentState.status = "cancelled"
                stopFlag = true;
                break
            case "waiting":
                currentState.status = "cancelled"


        }

    }

    isEmpty(comment, template) {
        const result = comment.length === 0 && template.length === 0
        if (result) alert("Не вся информация заполнена")
        return result
    }
}

class Countdown {
    constructor(minutes, seconds, view) {
        minutes = isNaN(parseInt(minutes)) ? 0 : parseInt(minutes)
        seconds = isNaN(parseInt(seconds)) ? 0 : parseInt(seconds);
        this.totalSeconds = minutes * 60 + seconds
        this.futureDate = Date.now() + this.totalSeconds * 1000;
        this.view = view
    }
    stop(){
        if (this.interval) clearInterval(this.interval)
        stopFlag = false;
        this.view.renderTimer("00", "00")

    }
    start(callback) {


        if(this.totalSeconds === 0 && stopFlag){
            this.stop()
            currentState.status = "cancelled"
            return
        }
        else if (this.totalSeconds === 0) {
            this.stop()
            callback()
            return
        }
        return new Promise((resolve)=>{
            this.interval =  setInterval( () => {
                if (stopFlag){
                    this.stop()
                    resolve()
                    return
                }
                const now = new Date()
                const delta = this.futureDate - now
                const time = this.milisToMinutes(delta)
                currentState.status="timer"
                this.view.renderTimer(time.minutes, time.seconds)
                if (delta <= 0) {
                    this.stop()
                    callback()
                    resolve()
                }
            }, 1000)
        })
    }

    twoDigitFormat(num) {
        return num.toString().length < 2 ? "0" + num.toString() : num.toString()
    }

    milisToMinutes(milis) {
        let totalSeconds = Math.round(milis / 1000);
        let minutes = this.twoDigitFormat(Math.trunc(totalSeconds / 60));
        let seconds = this.twoDigitFormat(totalSeconds % 60);
        return {minutes, seconds}
    }
}


class PanelView {
    constructor() {
        this.progresBar = {
            get node() {return document.querySelector(".status__lamp-panel")},
            get lamps() {return  [...this.node.querySelectorAll(".status__progress-lamp")]},
            increase(status){
                const lamp = this.getFirstEmpty();
                if (lamp) {
                    const lampClass = status === "success" ? "status__progress-lamp_success" : "status__progress-lamp_failed"
                    lamp.classList.add(lampClass)
                    this.saveState(status).then()
                }
            },
            async saveState(status){
                const progressBarState = await currentState.progresBar
                if (progressBarState.length === 0){
                    const arr = []
                    arr.push(status)
                    currentState.progresBar = arr
                } else {
                    progressBarState.push(status);
                    currentState.progresBar = progressBarState
                }
            },
            getFirstEmpty() {
                return this.lamps.find((lamp)=>lamp.classList.length === 1)
            },
            reset(){
                this.lamps.map((lamp)=>lamp.className = "status__progress-lamp")
                currentState.progresBar = []
            },
            restore(statement){
                if (statement){
                    for (const [index, status] of statement.entries()) {
                        const lampClass = status === "success" ? "status__progress-lamp_success" : "status__progress-lamp_failed"
                        panelView.progresBar.lamps[index].classList.add(lampClass)
                    }
                }
            },
        }
    }
    resetInterface() {
        this.progresBar.reset();
        this.ticketNumber = "";
        this.statusText = "";
    }

    set statusText(value) {
        document.querySelector(".status__progress-message").innerText = value;
    }

    set ticketNumber(value) {
        document.querySelector(".status__ticket-number").innerText = value;
    }

    set minutes(value) {
        document.querySelector(".timer__minutes").innerText = value;
    }

    set seconds(value) {
        document.querySelector(".timer__seconds").innerText = value;
    }



}


class PanelPresenter {
    constructor(view) {
        this.view = view;
    }

    set ticketNumber(number) {
        this.view.ticketNumber = number;

    }

    set statusText(msg) {
        this.statusTextNode.innerText = msg;
    }

    renderTimer(minutes, seconds) {
        this.view.minutes = minutes;
        this.view.seconds = seconds;
    }
}

const panelView = new PanelView();
const panel = new PanelPresenter(panelView);


chrome.runtime.onMessage.addListener(
    async function (request, sender, sendResponse) {
        showResultPanel();
        const handlers = new BtnHandlers();
        switch (request.message) {
            case "createBtnClick":
                await handlers.createBtnClick(request);
                break
            case "submitBtnClick":
                await handlers.submitBtnClick(request)
                break
            case "resetBtnClick":
                await handlers.resetBtnClick();

            // case "widgetOpened":
            //     break
        }

    });
currentState.loaded = new Date().toISOString();
async function restoreGuiStatement(){
    const storage = await chrome.storage.local.get(null);
    panelView.ticketNumber = storage.ticketNumber
    await renderState("status", storage.status)
    panelView.progresBar.restore(storage.progresBar)
}





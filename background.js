"use strict";

class Countdown{
    constructor(totalSeconds,clsSelector,callBackFn) {

        const now = new Date();
        this.deadline=now.setSeconds(now.getSeconds()+totalSeconds)
        this.node = document.querySelector(clsSelector);
        this.callBackFn = callBackFn;
    }
    reduceSeconds(){
        const delta = this.deadline - new Date();
        if (delta <= 0){
            clearInterval(this.interval)
            this.callBackFn?this.callBackFn():undefined;
        } else {

        }
    }
    renderTimer(){

    }

    start(){
        this.interval=setInterval(()=>{
            this.reduceSeconds();
        },1000);
    };

}

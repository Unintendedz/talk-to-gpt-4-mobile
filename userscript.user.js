// ==UserScript==
// @name         GPT-4 Mobile
// @name:zh-CN   GPT-4 Mobile
// @version      0.8
// @description  That users can enhance their conversations with the gpt-4-mobile model using a userscript. By combining resources from specific websites, one can remove restrictions on message limits and make GPT-4 Mobile the default model, including the incorporation of gpt-3.5 mobile option.
// @description:zh-CN 用户可以使用用户脚本来增强他们与 gpt-4-mobile 模型的对话。通过结合特定网站的资源，用户可以消除消息限制，并将 GPT-4 Mobile 设置为默认模型，包括引入 gpt-3.5 mobile 选项。
// @author       Unintendedz and enzheng128 and onepisYa
// @match        https://chat.openai.com/*
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-idle
// @license      MIT
// @namespace    https://greasyfork.org/en/scripts/467802-gpt-4-mobile
// ==/UserScript==

(function () {
  'use strict';
  // 用户类型事件监听
  window.addEventListener('UserTypeEvent', function (e) {
    GM_setValue('userType', e.detail.userType);
  });

  // ==========================================
  // =============== 脚本菜单处理 ===============
  // ==========================================
  // set default
  const BUTTONS_GROUPS = ['GPT-3.5'];
  const isPlus = GM_getValue('userType');
  let DEFAULT_BUTTON = 'GPT-3.5 Mobile';
  if (isPlus) {
    DEFAULT_BUTTON = 'GPT-4 Mobile';
    BUTTONS_GROUPS.push('GPT-4');
  }
  BUTTONS_GROUPS.push(DEFAULT_BUTTON);

  let menus = [];
  let isSwitch = false;

  // 注册脚本菜单
  const registerMenuCommand = () => {
    const onHandle = (value) => {
      GM_setValue('defaultModel', value);
      registerMenuCommand();

      if (isPlus === false) {
        switch (value) {
          case 'GPT-3.5':
            registerMenuCommand();
            window.location.href = "https://chat.openai.com/?model=text-davinci-002-render-sha";
            break;
          default:
            registerMenuCommand();
            window.location.href = "https://chat.openai.com/?model=text-davinci-002-render-sha-mobile";
            break;
        }
      } else {
        registerMenuCommand();
      }
    }
    if (!GM_getValue('defaultModel')) GM_setValue('defaultModel', DEFAULT_BUTTON)
    const defaultValue = GM_getValue('defaultModel')
    menus.forEach(menu => GM_unregisterMenuCommand(menu));
    menus = BUTTONS_GROUPS.map((buttonText) => GM_registerMenuCommand(`切换默认为：${buttonText}${defaultValue === buttonText ? '（当前）' : ''}`, () => onHandle(buttonText)))
  }

  const checkButton = (addedNode) => {
    const model = `${GM_getValue('defaultModel')}`
    console.log("current model button should be", model);
    if (addedNode.nodeType === Node.ELEMENT_NODE) {
      const buttons = addedNode.querySelectorAll('button');
      for (let button of buttons) {
        if (button.textContent === model) {
          button.querySelector('span')?.click();
          button.querySelector('span')?.click();
          button.querySelector('span')?.click();
          return true;
        }
      }
    }
    return false;
  }

  const handleClick = () => {
    isSwitch = true;
  }

  // 监听newChat事件
  const addEventTargetA = () => {
    const buttons = document.querySelectorAll('a')
    for (const button of buttons) {
      if (button.textContent === 'New chat') {
        button.removeEventListener('click', handleClick)
        button.addEventListener('click', handleClick)
        break;
      }
    }
  }

  const callback = (mutationRecords) => {
    for (const mutationRecord of mutationRecords) {
      if (mutationRecord.addedNodes.length) {
        for (const addedNode of mutationRecord.addedNodes) {
          if (checkButton(addedNode)) return;
        }
      }
    }
    addEventTargetA()
  };
  registerMenuCommand()
  addEventTargetA();
  const observer = new MutationObserver(callback);
  observer.observe(document.getElementById('__next'), {
    childList: true,
    subtree: true,
  });
  // 修改pushStatus和replaceStatus
  const pushState = window.history.pushState;
  const replaceState = window.history.replaceState;
  window.history.pushState = function () {
    if (isSwitch) {
      // 等到 openai 发送的请求完毕之后，将它原本的model历史记忆设置完成之后，我们再设置自己想要的默认模型。
      setTimeout(() => checkButton(document.getElementById('__next')), 500)
    }
    pushState.apply(this, arguments);
    isSwitch = false
  }
  window.history.replaceState = function () {
    if (isSwitch) {
      setTimeout(() => checkButton(document.getElementById('__next')), 500)
    }
    replaceState.apply(this, arguments);
    isSwitch = false
  }

  // =========================================================
  // =============== fetch 拦截 添加gpt-4 mobile ==============
  // =========================================================
  // 将代码插入到网页中
  const script = document.createElement('script');
  // add mobile GPT-4
  script.textContent = `
      let waitIsPlus = null;
      let resolveIsPlus = null;
      let isPlus = null;
      waitIsPlus = new Promise((resolve) => {
        resolveIsPlus = resolve;
      });
      const responseHandlers = {
        'https://chat.openai.com/backend-api/models': async function (response) {
          const body = await response.clone().json();
          if (isPlus === null) {
            await waitIsPlus;
          }
          const model = isPlus ? {
            "category": "gpt_4",
            "human_category_name": "GPT-4 Mobile",
            "subscription_level": "plus",
            "default_model": "gpt-4-mobile"
          } : {
            "category": "gpt_4",
            "human_category_name": "GPT-3.5 Mobile",
            "subscription_level": "free",
            "default_model": "text-davinci-002-render-sha-mobile"
          };
          body.categories.push(model);

          let event = new CustomEvent('UserTypeEvent', { detail: { userType: isPlus } });
          window.dispatchEvent(event);
          return new Response(JSON.stringify(body), {
            status: response.status,
            statusText: response.statusText,
            headers: { 'Content-Type': 'application/json' }
          });
        },

        'https://chat.openai.com/backend-api/moderations': async function (response) {
          const body = await response.clone().json();
          body.flagged = false;
          body.blocked = false;

          return new Response(JSON.stringify(body), {
            status: response.status,
            statusText: response.statusText,
            headers: { 'Content-Type': 'application/json' }
          });
        },
        'https://chat.openai.com/backend-api/accounts/check': async function (response) {
          const body = await response.clone().json();
          const subscription_plan = body.accounts.default.entitlement.subscription_plan;
          isPlus = subscription_plan === 'chatgptplusplan';

          return (() => { resolveIsPlus(); return response })();
        },
      };
      window.fetch = new Proxy(window.fetch, {
        apply: async function (target, thisArg, argumentsList) {
          const response = await Reflect.apply(...arguments);
          for (let key in responseHandlers) {
            if (argumentsList[0].includes(key)) {
              return responseHandlers[key](response);
            }
          }
          return response;
        }
      });
    `;
  document.body.appendChild(script);
})();

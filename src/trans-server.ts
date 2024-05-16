import * as vscode from 'vscode';
import axios from 'axios';
import { GoogleGenerativeAI } from "@google/generative-ai";

const config = vscode.workspace.getConfiguration("trans-box");

export async function translateText(text: string) {
  const server = config.get("server");
  const serverList: any = config.get("serverList");
  let serverConfig, key, prompt, result;
  switch (server) {
    case "Gemini":
      serverConfig = serverList[server];
      key = serverConfig.key;
      prompt = serverConfig.prompt;
      result = await gemini(text, prompt, key);
      break;
    case "Wenxin":
      serverConfig = serverList[server];
      const ak = serverConfig.ak;
      const sk = serverConfig.sk;
      prompt = serverConfig.prompt;
      result = await wenxin(text, ak, sk);
      break;
    default:
      break;
  }
  return result;
}

async function gemini(text: string, prompt: string, key: string) {
  const generativeAI = new GoogleGenerativeAI(key);
  const model = generativeAI.getGenerativeModel({ model: "gemini-pro" });

  const content = `${prompt}\n${text}`;
  try {
    const result = await model.generateContent(content);
    const translatedText = result.response.text();
    return translatedText;
  } catch (error) {
    vscode.window.showErrorMessage(JSON.stringify(error));
    return undefined;
  }
}

async function wenxin(text: string, ak: string, sk: string) {

  async function getAccessToken() {
    const api =
      'https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=' + ak
      + '&client_secret=' + sk;
    try {
      const response = await axios.post(api);
      return response.data.access_token;
    } catch (error) {
      console.log(error);
    }
  };

  let config = {
    url: 'https://aip.baidubce.com/rpc/2.0/mt/texttrans/v1?access_token=' + await getAccessToken(),
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    data: JSON.stringify({
      "from": "en",
      "to": "zh",
      "q": text
    })
  };

  let response: any = await axios(config)
    .then((response) => {
      return response;
    })
    .catch((error) => {
      vscode.window.showErrorMessage(error);
    });
  const result: [any] = response.data.result.trans_result;
  const translated = result.reduce((acc, current) => { return (acc + current.dst); }, "");
  console.log(translated);
  return Promise.resolve(translated);
}

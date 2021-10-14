const axios = require('axios').default;

const USERNAME = "USERNAME";
const PASSWORD = "PASSWORD";

let tokens = new Object();
let headers = new Object();

let ssid_cookie = new String();
let client_version = new String();

const parseUrl = (uri) => {
    let url = new URL(uri)
    let params = new URLSearchParams(url.hash.substring(1))
    let access_token = params.get('access_token')
    let id_token = params.get('id_token')
    let expires_in = parseInt(params.get('expires_in'));

    return { access_token, id_token, expires_in };
}

const client_platform = {
    platformType: "PC",
    platformOS: "Windows",
    platformOSVersion: "10.0.19043.1.256.64bit",
    platformChipset: "Unknown"
};

const makeHeaders = () => {
    headers = {
        Authorization: `Bearer ${tokens.access_token}`,
        'X-Riot-Entitlements-JWT': tokens.entitlements_token,
        'X-Riot-ClientVersion': client_version,
        'X-Riot-ClientPlatform': Buffer.from(JSON.stringify(client_platform)).toString('base64'),
    }
}

const setupReauth = async () => {
    // access token -> every 1h | id token -> every 24h
    setInterval(async () => {
        try {
            const access_tokens = await axios.post('https://auth.riotgames.com/api/v1/authorization', {
                client_id: "play-valorant-web-prod",
                nonce: 1,
                redirect_uri: "https://playvalorant.com/opt_in",
                response_type: "token id_token"
            }, { headers: {
                Cookie: ssid_cookie
            }});

            ssid_cookie = access_tokens.headers['set-cookie'].find(elem => /^ssid/.test(elem));

            tokens = { ...tokens, ...parseUrl(access_tokens.data.response.parameters.uri) };
            makeHeaders();
        } catch (err) {
            console.trace(err)
        }
    }, tokens.expires_in * 1000)
}

(async function () {
    const cookie = (await axios.post('https://auth.riotgames.com/api/v1/authorization', {
        client_id: "play-valorant-web-prod",
        nonce: 1,
        redirect_uri: "https://playvalorant.com/opt_in",
        response_type: "token id_token"
    })).headers['set-cookie'].find(elem => /^asid/.test(elem));

    client_version = (await axios.get('https://valorant-api.com/v1/version')).data.data.riotClientVersion;

    const access_tokens = await axios.put('https://auth.riotgames.com/api/v1/authorization', {
        type: "auth",
        username: USERNAME,
        password: PASSWORD
    }, { headers: {
        Cookie: cookie
    }});

    ssid_cookie = access_tokens.headers['set-cookie'].find(elem => /^ssid/.test(elem));

    tokens = parseUrl(access_tokens.data.response.parameters.uri);
    
    tokens.entitlements_token = (await axios.post('https://entitlements.auth.riotgames.com/api/token/v1', {}, { headers: {
        Authorization: `Bearer ${tokens.access_token}`,
    }})).data.entitlements_token;

    const puuid = JSON.parse(Buffer.from(tokens.access_token.split('.')[1], 'base64').toString()).sub;

    makeHeaders();
    setupReauth();

    console.log({...headers, puuid})
})()
import https from 'https';

const httpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 100, // tune based on your environment
});

export async function postData(url, body) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      agent: httpsAgent,
    });

    console.info('POST Response:', {
      url,
      status: response.status,
    });

    if (!response.ok) {
      console.error(`Fail to POST ${url}`);
      return;
    }

    const data = await response.json();

    return data;
  } catch (error) {
    console.error('Error Post Data', error);

    return null;
  }
}

export async function getData(url) {
  try {
    const response = await fetch(url, {
      agent: httpsAgent,
    });

    console.info('GET Response:', {
      url,
      status: response.status,
    });

    if (!response.ok) {
      console.error(`Fail to GET ${url}`);
      return;
    }

    const data = await response.json();

    return data;
  } catch (error) {
    console.error('Error Get Data', error);

    return null;
  }
}

export async function putData(url, body) {
  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      agent: httpsAgent,
    });

    console.info('PUT Response:', {
      url,
      status: response.status,
    });

    if (!response.ok) {
      console.error(`Fail to PUT ${url}`);
      return;
    }

    const data = await response.json();

    return data;
  } catch (error) {
    console.error('Error Put Data', error);

    return null;
  }
}

export async function patchData(url, body) {
  try {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      agent: httpsAgent,
    });

    console.info('PATCH Response:', {
      url,
      status: response.status,
    });

    if (!response.ok) {
      console.error(`Fail to PATCH ${url}`);
      return;
    }

    const data = await response.json();

    return data;
  } catch (error) {
    console.error('Error Patch Data', error);

    return null;
  }
}

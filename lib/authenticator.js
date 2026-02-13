import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { randomUUID } from 'crypto';
import {
  ENVIRONMENT,
  AUD,
  AUTH_DOMAIN,
  SCOPE,
  AUTHORIZATION_KEY,
} from '../env-config.js';

class Authenticator {
  constructor() {
    this.cachedAuthentication = null;
  }

  /**
   * Returns a valid cached access token if available, otherwise null.
   * A token is valid if it exists, has requestDateTime and expires_in,
   * and has not expired (with a 60 second margin).
   */
  getCachedToken() {
    const cachedAuth = this.cachedAuthentication;
    if (cachedAuth?.access_token && cachedAuth?.requestDateTime && cachedAuth?.expires_in) {
      const issuedAt =
        cachedAuth.requestDateTime instanceof Date ? cachedAuth.requestDateTime : new Date(cachedAuth.requestDateTime);
      const expiresIn = Number(cachedAuth.expires_in);
      const now = new Date();
      // 60 seconds margin before expiry
      const expiry = new Date(issuedAt.getTime() + (expiresIn - 60) * 1000);
      if (now < expiry) {
        return cachedAuth.access_token;
      }
    }
    return null;
  }

  async getAccessToken(clientId) {
    // First, try to return a valid cached token
    const cachedToken = this.getCachedToken();
    if (cachedToken) {
      return cachedToken;
    }

    // If no valid cached token, proceed to fetch a new one
    console.log('Fetching new access token...');

    if (ENVIRONMENT !== 'PROD') {
      return this.fetchTokenDev(clientId);
    } else {
      return this.fetchTokenProd(clientId);
    }
  }

  async fetchTokenDev(clientId) {
    const authorizationKey = AUTHORIZATION_KEY;
    if (!authorizationKey) {
      console.error('Error: AUTHORIZATION_KEY environment variable is not defined.');
      throw new Error('AUTHORIZATION_KEY environment variable is required but not defined.');
    }

    try {
      const response = await axios.post(
        `${AUD}/v1/token`,
        new URLSearchParams({
          grant_type: 'client_credentials',
          scope: SCOPE,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: 'Basic ' + authorizationKey,
          },
        }
      );

      const responseJson = response.data;
      responseJson.requestDateTime = new Date();
      this.cachedAuthentication = responseJson;
      return responseJson.access_token;
    } catch (error) {
      console.error('Error:', error.response?.status || error.message);
      console.error('Error details:', error.response?.data || error);
      throw new Error('failed to fetch access token: ' + (error.response?.status || error.message));
    }
  }

  async fetchTokenProd(clientId) {
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 9 * 60; // 9 minutes from now

    const payload = {
      iss: clientId,
      sub: clientId,
      aud: AUD,
      exp: exp,
      jti: randomUUID(),
      iat: iat,
    };

    const keyTest = this.getKeyFromConfig('/config');

    if (!keyTest) {
      throw new Error('No RSA key found in /config directory');
    }

    const token = jwt.sign(payload, keyTest, { algorithm: 'RS256' });

    try {
      const response = await axios.post(
        `https://${AUTH_DOMAIN}/op/v1/token`,
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
          scope: SCOPE,
          client_assertion: token,
        }),
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const responseJson = response.data;
      responseJson.requestDateTime = new Date();
      this.cachedAuthentication = responseJson;
      return responseJson.access_token;
    } catch (error) {
      console.error('Error:', error.response?.status || error.message);
      console.error('Error details:', error.response?.data || error);
      throw new Error('failed to fetch access token: ' + (error.response?.status || error.message));
    }
  }

  getKeyFromConfig(configPath) {
    if (!fs.existsSync(configPath)) {
      console.error(`The specified directory does not exist: ${configPath}`);
      return null;
    }

    const files = fs.readdirSync(configPath);
    const keyFiles = files.filter((file) => file.endsWith('.pem')).map((file) => path.join(configPath, file));

    if (keyFiles.length === 0) {
      console.error(`No key files found in the specified directory: ${configPath}`);
      return null;
    }

    const keyFile = keyFiles[0];
    const key = fs.readFileSync(keyFile, 'utf8');
    return key;
  }
}

export default Authenticator;

import { HttpService } from '@nestjs/axios';
import type { AxiosResponse } from 'axios';
import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { lastValueFrom } from 'rxjs';

interface SmartbotSendMessageInput {
  senderId: string;
  sessionId: string;
  text: string;
  metadata?: Record<string, unknown>;
  systemPrompt?: string;
  advancePrompt?: string;
}

interface SmartbotCardButton {
  title?: string;
  payload?: string;
  payload_id?: string;
  type?: string;
  button_variables?: Array<Record<string, unknown>>;
}

interface SmartbotCardData {
  type?: string;
  text?: string;
  title?: string;
  subtitle?: string;
  audio_url?: string | null;
  play_type?: string;
  buttons?: SmartbotCardButton[];
}

interface SmartbotResponse {
  message?: string;
  object?: {
    sb?: {
      text_id?: string;
      intent_name?: string | null;
      card_data?: SmartbotCardData[];
      card_data_info?: {
        totals?: number;
        current?: number;
        status?: number;
      };
    };
    type?: string;
    fee?: Record<string, unknown>;
  };
  challengeCode?: string;
  logID?: string;
}

@Injectable()
export class VnptSmartbotService {
  private readonly logger = new Logger(VnptSmartbotService.name);
  private readonly mode = process.env.VNPT_SMARTBOT_MODE || 'mock';
  private readonly baseUrl = process.env.VNPT_SMARTBOT_BASE_URL || 'https://assistant-stream.vnpt.vn';
  private readonly endpoint = process.env.VNPT_SMARTBOT_ENDPOINT || '/v1/conversation';
  private readonly botId = process.env.VNPT_SMARTBOT_BOT_ID || '';
  private readonly tokenId = process.env.VNPT_SMARTBOT_TOKEN_ID || '';
  private readonly tokenKey = process.env.VNPT_SMARTBOT_TOKEN_KEY || '';
  private readonly authBaseUrl = process.env.VNPT_SMARTBOT_AUTH_BASE_URL || 'https://api.idg.vnpt.vn';
  private readonly authEndpoint = process.env.VNPT_SMARTBOT_AUTH_ENDPOINT || '/auth/oauth/token';
  private readonly username = process.env.VNPT_SMARTBOT_USERNAME || '';
  private readonly password = process.env.VNPT_SMARTBOT_PASSWORD || '';
  private readonly inputChannel = process.env.VNPT_SMARTBOT_INPUT_CHANNEL || 'app';
  private accessToken = this.normalizeBearerToken(process.env.VNPT_SMARTBOT_ACCESS_TOKEN || '');
  private refreshTokenPromise: Promise<void> | null = null;

  constructor(private readonly httpService: HttpService) {}

  private get isMock() {
    return this.mode !== 'live' && this.mode !== 'production';
  }

  async sendMessage(input: SmartbotSendMessageInput) {
    if (this.isMock) {
      return {
        replyText: `Pockie AI da nhan: ${input.text}`,
        cardData: [
          {
            type: 'text',
            text: `Pockie AI da nhan: ${input.text}`,
            buttons: [],
            audio_url: null,
            play_type: 'text',
          },
        ],
        raw: {
          message: 'MOCK',
          object: {
            sb: {
              intent_name: null,
              card_data: [
                {
                  type: 'text',
                  text: `Pockie AI da nhan: ${input.text}`,
                  buttons: [],
                  audio_url: null,
                  play_type: 'text',
                },
              ],
              card_data_info: { status: 0, totals: 1, current: 1 },
            },
            type: 'normal',
          },
        } satisfies SmartbotResponse,
      };
    }

    const response = await this.requestWithRetry(async () => {
      const headers = await this.buildHeaders();
      return lastValueFrom(
        this.httpService.post(
          `${this.baseUrl}${this.endpoint}`,
          {
            sender_id: input.senderId,
            session_id: input.sessionId,
            bot_id: this.botId,
            text: input.text,
            input_channel: this.inputChannel,
            metadata: input.metadata || {},
            settings: {
              system_prompt: input.systemPrompt || '',
              advance_prompt: input.advancePrompt || '',
            },
          },
          {
            headers,
            responseType: 'text',
          },
        ),
      );
    });

    const raw = this.parseSmartbotResponse(response) || {};
    const cardData = raw.object?.sb?.card_data || [];
    const replyText = this.buildReplyText(cardData);

    return {
      replyText: replyText || 'Pockie AI tam thoi chua tra ve noi dung phu hop.',
      cardData,
      raw,
    };
  }

  private async buildHeaders() {
    const token = await this.getAccessToken();
    return {
      Authorization: `Bearer ${token}`,
      'Token-id': this.tokenId,
      'Token-key': this.tokenKey,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    };
  }

  private async getAccessToken() {
    if (this.accessToken) {
      return this.accessToken;
    }

    await this.refreshAccessToken();

    if (this.accessToken) {
      return this.accessToken;
    }

    throw new BadGatewayException('Missing VNPT SmartBot access token');
  }

  private async requestWithRetry<T>(requestFn: () => Promise<T>) {
    try {
      return await requestFn();
    } catch (error: any) {
      if (error.response?.status !== 401) {
        throw error;
      }

      this.logger.warn('Received 401 from SmartBot. Attempting token refresh...');

      if (!this.username || !this.password) {
        throw new BadGatewayException('SmartBot access token expired and no refresh credentials were configured');
      }

      if (!this.refreshTokenPromise) {
        this.refreshTokenPromise = this.refreshAccessToken().finally(() => {
          this.refreshTokenPromise = null;
        });
      }

      await this.refreshTokenPromise;
      return requestFn();
    }
  }

  private async refreshAccessToken() {
    if (!this.username || !this.password) {
      throw new Error('Cannot refresh SmartBot access token: missing username/password');
    }

    const response = await lastValueFrom(
      this.httpService.post(`${this.authBaseUrl}${this.authEndpoint}`, {
        username: this.username,
        password: this.password,
        client_id: 'clientapp',
        grant_type: 'password',
        client_secret: 'password',
      }),
    );

    const nextToken =
      response.data?.access_token ||
      response.data?.token ||
      response.data?.data?.access_token ||
      '';

    if (!nextToken || typeof nextToken !== 'string') {
      throw new Error('Unable to extract SmartBot access token from auth response');
    }

    this.accessToken = this.normalizeBearerToken(nextToken);
    this.logger.log('Successfully refreshed SmartBot access token');
  }

  private normalizeBearerToken(value: string) {
    return value.replace(/^Bearer\s+/i, '').trim();
  }

  private parseSmartbotResponse(response: AxiosResponse<unknown>): SmartbotResponse | null {
    const payload = response.data;

    if (payload && typeof payload === 'object') {
      return payload as SmartbotResponse;
    }

    if (typeof payload !== 'string') {
      return null;
    }

    const trimmed = payload.trim();
    if (!trimmed) {
      return null;
    }

    try {
      return JSON.parse(trimmed) as SmartbotResponse;
    } catch {
      // Try parsing SSE frames.
    }

    const sseDataChunks = trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .filter(Boolean);

    for (let index = sseDataChunks.length - 1; index >= 0; index -= 1) {
      try {
        return JSON.parse(sseDataChunks[index]) as SmartbotResponse;
      } catch {
        continue;
      }
    }

    this.logger.warn(`Unable to parse SmartBot response payload: ${trimmed.slice(0, 400)}`);
    return null;
  }

  private buildReplyText(cardData: SmartbotCardData[]) {
    return cardData
      .map((card) => {
        if (typeof card.text === 'string' && card.text.trim()) {
          return card.text.trim();
        }

        const textParts = [card.title, card.subtitle].filter(
          (part) => typeof part === 'string' && part.trim(),
        );
        return textParts.join('\n').trim();
      })
      .filter(Boolean)
      .join('\n\n');
  }
}

// src/guards/api-key.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  private readonly apiKey = process.env.API_KEY || 'MINHA_API_KEY_SECRETA';

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    const authHeader = request.headers['authorization'];

    if (!authHeader || authHeader !== `Bearer ${this.apiKey}`) {
      throw new UnauthorizedException('API key inválida ou ausente');
    }

    return true;
  }
}

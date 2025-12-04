import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        private prisma: PrismaService,
        private configService: ConfigService,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.get<string>('JWT_SECRET') || process.env.JWT_SECRET || 'secretKey',
        });
    }
    
    async validate(payload: any) {
        
        const user = await this.prisma.users.findUnique({
            where: { user_userId: payload.sub },
        });

     
        if (!user || !user.user_IsActive) {
            throw new UnauthorizedException('Użytkownik nieaktywny lub nie istnieje');
        }

       
        const { user_PasswordHash, ...safeUser } = user;

       
        return safeUser;
    }
}
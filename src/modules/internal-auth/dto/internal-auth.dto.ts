import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InternalLoginDto {
  @ApiProperty({ example: 'superadmin@pockie.local' })
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty({ message: 'Email là bắt buộc' })
  email: string;

  @ApiProperty({ example: 'Admin@123456' })
  @IsString()
  @IsNotEmpty({ message: 'Mật khẩu là bắt buộc' })
  @MinLength(6, { message: 'Mật khẩu phải từ 6 ký tự' })
  password: string;
}

export class InternalRefreshDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class InternalLogoutDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class UserInfoRequestDto {
  // Możesz zostawić puste lub z polami, które wysyła frontend.
  // Ponieważ używamy Guard('jwt'), token bierzemy z nagłówka, a to DTO jest ignorowane.
  accessToken?: string;
}

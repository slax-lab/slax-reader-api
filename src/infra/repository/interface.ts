export interface ISubDatabase {
  getUserSubscriptionInfo(userId: number): Promise<any>
  upsertUserSubscription(userId: number, customerId: string): Promise<any>
  getUserSubscriptionPeriodBySubscriptionId(subId: string): Promise<any>
  getUserSubscriptionPeriod(userId: number): Promise<any>
  createUserSubscriptionRecordMany(data: any): Promise<any>
  upsertUserSubscriptionRecord(data: any): Promise<any>
}

export interface IUserDatabase {
  getInfoByUserId(id: number): Promise<any>
}

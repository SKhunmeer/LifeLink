import { NotificationChannel, NotificationStatus } from '@bloodlink/shared';
export interface SendSmsParams {
    recipientPhone: string;
    messageBody: string;
    requestId?: string;
    donorUuid?: string;
    channel?: NotificationChannel;
    allowDuplicate?: boolean;
}
export interface SmsDispatchResult {
    success: boolean;
    status: NotificationStatus;
    sid: string;
    recipientPhoneMasked: string;
    messageBody: string;
    isSimulated: boolean;
    error?: string;
}
export declare function sendEmergencyNotification(params: SendSmsParams): Promise<SmsDispatchResult>;
export declare function formatDonorAlertMessage(hospitalName: string, bloodGroup: string, requestId: string, appUrl?: string): string;
export declare function formatStockAlertMessage(hospitalName: string, bloodGroup: string, component: string, currentUnits: number): string;

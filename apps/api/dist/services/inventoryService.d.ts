import { BloodGroup, BloodComponent, InventoryStatus, BloodInventoryItem } from '@bloodlink/shared';
export interface InventoryFilter {
    hospitalId?: string;
    bloodGroup?: BloodGroup;
    component?: BloodComponent;
    status?: InventoryStatus;
}
export declare function getInventory(filters?: InventoryFilter): BloodInventoryItem[];
export declare function getAvailableInventoryForMatching(hospitalId: string, bloodGroup: BloodGroup, component: BloodComponent): BloodInventoryItem[];
/**
 * Atomic inventory adjustment wrapped in an immediate database transaction
 */
export declare function adjustInventoryAtomic(params: {
    inventoryId: string;
    action: 'add' | 'reserve' | 'issue' | 'quarantine' | 'expire' | 'release';
    units: number;
    reason: string;
    referenceRequestId?: string;
    performedByUserId: string;
}): {
    item: any;
    newCount: any;
};
/**
 * Checks if stock drops below critical threshold and alerts staff
 */
export declare function checkAndTriggerStockAlerts(hospitalId: string, bloodGroup: BloodGroup, component: BloodComponent): void;
/**
 * Returns inventory analytics and threshold monitoring status
 */
export declare function getInventoryAnalytics(): {
    totalUnits: {
        status: string;
        count: number;
    }[];
    stockByBloodGroup: any[];
    hospitalStocks: any[];
    requestStats: any[];
};

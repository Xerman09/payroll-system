export interface Membership {
  id: number;
  user_id: number;
  monthly_amount: number;
  start_date: string | null;
  end_date: string | null;
  is_active: number;
  created_by: number;
}

export interface User {
  user_id: number;
  user_fname: string;
  user_lname: string;
  is_deleted?: boolean | { data: [number] };
  isDeleted?: boolean;
  deleted?: boolean;
}

export interface EmployeeLoan {
  loan_id: number;
  user_id: number;
  loan_amount: number;
  interest_rate: number;
  interest_amount: number;
  net_amount_released: number;
  months_to_pay: number;
  monthly_payment: number;
  start_date: string;
  end_date: string | null;
  status: "ACTIVE" | "PAID" | "CANCELLED";
  created_by?: number;
  created_date?: string;
  updated_by?: number | null;
  updated_date?: string | null;
}

export interface LoanPayment {
  id?: number;
  loan_id?: number;
  amount?: string | number;
  payment_date?: string;
}

export type LoanRowData = {
  loan: EmployeeLoan;
  name: string;
  loanAmount: number;
  totalPaid: number;
  balance: number;
};

export type SortConfig =
  | {
      key: string;
      direction: "asc" | "desc";
    }
  | null;

export interface TabContentProps {
  searchTerm: string;
  statusFilter: string;
  refreshTrigger: number;
  isAddModalOpen: boolean;
  onCloseAddModal: () => void;
}

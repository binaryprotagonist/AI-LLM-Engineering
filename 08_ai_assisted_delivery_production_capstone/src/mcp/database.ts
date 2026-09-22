export interface EmployeeRecord {
  id: string;
  tenantId: string;
  name: string;
  department: string;
  role: string;
  leaveDaysRemaining: number;
  status: "active" | "on_leave" | "terminated";
}

export interface DepartmentStats {
  department: string;
  totalEmployees: number;
  activeCount: number;
  averageLeaveDaysRemaining: number;
}

export interface LeaveRequest {
  id: string;
  tenantId: string;
  employeeId: string;
  days: number;
  reason: string;
  status: "pending_approval" | "approved" | "rejected";
  createdAt: string;
}

export class BusinessServiceDatabase {
  private readonly employees: Map<string, EmployeeRecord> = new Map([
    [
      "user-001",
      {
        id: "user-001",
        tenantId: "tenant-001",
        name: "Alice Johnson",
        department: "Engineering",
        role: "Senior Staff Engineer",
        leaveDaysRemaining: 15,
        status: "active"
      }
    ],
    [
      "user-002",
      {
        id: "user-002",
        tenantId: "tenant-001",
        name: "Bob Smith",
        department: "Product",
        role: "Lead Product Manager",
        leaveDaysRemaining: 12,
        status: "active"
      }
    ],
    [
      "user-003",
      {
        id: "user-003",
        tenantId: "tenant-001",
        name: "Carol Danvers",
        department: "Engineering",
        role: "Security Architect",
        leaveDaysRemaining: 18,
        status: "active"
      }
    ]
  ]);

  private readonly leaveRequests: Map<string, LeaveRequest> = new Map();

  getEmployee(tenantId: string, employeeId: string): EmployeeRecord | null {
    const employee = this.employees.get(employeeId);
    if (!employee || employee.tenantId !== tenantId) {
      return null;
    }
    return { ...employee };
  }

  getDepartmentStats(tenantId: string, department: string): DepartmentStats | null {
    const matched = Array.from(this.employees.values()).filter(
      (e) => e.tenantId === tenantId && e.department.toLowerCase() === department.toLowerCase()
    );

    if (matched.length === 0) {
      return null;
    }

    const totalEmployees = matched.length;
    const activeCount = matched.filter((e) => e.status === "active").length;
    const totalLeaveDays = matched.reduce((acc, curr) => acc + curr.leaveDaysRemaining, 0);

    return {
      department,
      totalEmployees,
      activeCount,
      averageLeaveDaysRemaining: Math.round((totalLeaveDays / totalEmployees) * 10) / 10
    };
  }

  createLeaveRequest(
    tenantId: string,
    employeeId: string,
    days: number,
    reason: string
  ): LeaveRequest {
    const id = `leave-${Date.now()}`;
    const request: LeaveRequest = {
      id,
      tenantId,
      employeeId,
      days,
      reason,
      status: "pending_approval",
      createdAt: new Date().toISOString()
    };
    this.leaveRequests.set(id, request);
    return request;
  }

  updateLeaveRequestStatus(
    id: string,
    status: "approved" | "rejected"
  ): LeaveRequest | null {
    const existing = this.leaveRequests.get(id);
    if (!existing) return null;
    existing.status = status;
    if (status === "approved") {
      const employee = this.employees.get(existing.employeeId);
      if (employee) {
        employee.leaveDaysRemaining = Math.max(0, employee.leaveDaysRemaining - existing.days);
      }
    }
    return { ...existing };
  }
}

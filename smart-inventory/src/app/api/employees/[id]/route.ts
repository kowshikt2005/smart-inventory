import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { hashPassword, hasRole } from '@/lib/auth-utils';

// GET /api/employees/[id] - Get single employee (Admin only)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user || !hasRole(session.user.role, 'ADMIN')) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const { id } = await params;

    const employee = await db.employee.findUnique({
      where: { id },
      select: {
        id: true,
        employeeNumber: true,
        name: true,
        email: true,
        phone: true,
        designation: true,
        department: true,
        salary: true,
        joinDate: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    // Get user role
    const user = employee.email ? await db.user.findUnique({
      where: { email: employee.email },
      select: { role: true },
    }) : null;

    return NextResponse.json({
      ...employee,
      role: user?.role || 'SALESMAN',
    });
  } catch (error) {
    console.error('Error fetching employee:', error);
    return NextResponse.json(
      { error: 'Failed to fetch employee' },
      { status: 500 }
    );
  }
}

// PUT /api/employees/[id] - Update employee (Admin only)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user || !hasRole(session.user.role, 'ADMIN')) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    console.log('🔄 Updating employee:', id);
    console.log('📝 Update data:', JSON.stringify(body, null, 2));

    // Check if employee exists
    const existingEmployee = await db.employee.findUnique({
      where: { id },
    });

    if (!existingEmployee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    // Validate role if provided
    if (body.role) {
      const validRoles = ['SALESMAN', 'BILLING_OPERATOR', 'ACCOUNTANT', 'MANAGER', 'ADMIN'];
      if (!validRoles.includes(body.role)) {
        return NextResponse.json(
          { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Check if email is being changed and if it already exists
    if (body.email && body.email !== existingEmployee.email) {
      const existingUser = await db.user.findUnique({
        where: { email: body.email },
      });

      if (existingUser) {
        return NextResponse.json(
          { error: 'Email already exists' },
          { status: 400 }
        );
      }
    }

    // Update employee and user in transaction
    const result = await db.$transaction(async (tx) => {
      // Update employee record
      const employee = await tx.employee.update({
        where: { id },
        data: {
          name: body.name || existingEmployee.name,
          email: body.email || existingEmployee.email,
          phone: body.phone !== undefined ? body.phone : existingEmployee.phone,
          designation: body.designation !== undefined ? body.designation : existingEmployee.designation,
          department: body.department !== undefined ? body.department : existingEmployee.department,
          salary: body.salary !== undefined ? (body.salary ? Number(body.salary) : null) : existingEmployee.salary,
          joinDate: body.joinDate ? new Date(body.joinDate) : existingEmployee.joinDate,
          isActive: body.isActive !== undefined ? body.isActive : existingEmployee.isActive,
        },
      });

      // Update user account
      const userUpdateData: {
        name: string;
        email: string;
        isActive: boolean;
        role?: string;
        password?: string;
      } = {
        name: body.name || existingEmployee.name,
        email: body.email || existingEmployee.email,
        isActive: body.isActive !== undefined ? body.isActive : existingEmployee.isActive,
      };

      if (body.role) {
        userUpdateData.role = body.role;
      }

      if (body.password) {
        userUpdateData.password = await hashPassword(body.password);
      }

      // Update user account if email exists
      if (existingEmployee.email) {
        console.log('🔄 Updating user account for:', existingEmployee.email);
        console.log('📝 User update data:', JSON.stringify(userUpdateData, null, 2));
        
        await tx.user.update({
          where: { email: existingEmployee.email },
          data: userUpdateData,
        });
        
        console.log('✅ User account updated successfully');
      }

      return employee;
    });

    // Get updated user role
    const user = result.email ? await db.user.findUnique({
      where: { email: result.email },
      select: { role: true },
    }) : null;

    const responseData = {
      ...result,
      role: user?.role || 'SALESMAN',
    };

    console.log('✅ Employee update completed');
    console.log('📝 Response data:', JSON.stringify(responseData, null, 2));

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error updating employee:', error);
    return NextResponse.json(
      { error: 'Failed to update employee' },
      { status: 500 }
    );
  }
}

// DELETE /api/employees/[id] - Delete employee (Admin only)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user || !hasRole(session.user.role, 'ADMIN')) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Check if employee exists
    const existingEmployee = await db.employee.findUnique({
      where: { id },
    });

    if (!existingEmployee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    // Don't allow deleting the current user
    if (existingEmployee.email === session.user.email) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    // Delete employee and user in transaction
    await db.$transaction(async (tx) => {
      // Delete employee record
      await tx.employee.delete({
        where: { id },
      });

      // Delete user account if email exists
      if (existingEmployee.email) {
        await tx.user.delete({
          where: { email: existingEmployee.email },
        });
      }
    });

    return NextResponse.json({
      message: 'Employee deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting employee:', error);
    return NextResponse.json(
      { error: 'Failed to delete employee' },
      { status: 500 }
    );
  }
}
import { NextResponse } from 'next/server';
import { db, transaction } from '@/lib/db';
import { hashPassword } from '@/lib/auth-utils';
import { checkPermission } from '@/lib/api-auth';

// GET /api/employees/[id] - Get single employee
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await checkPermission('masters_employees', 'view');
    if (error) return error;

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
        photoUrl: true,
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

    // Fetch role via User → Role join
    const user = employee.email ? await (db.user.findUnique as any)({
      where: { email: employee.email },
      select: { roleId: true, roleRef: { select: { name: true } } },
    }) as { roleId: string | null; roleRef: { name: string } | null } | null : null;

    return NextResponse.json({
      ...employee,
      roleId: user?.roleId || '',
      roleName: user?.roleRef?.name || 'Unknown',
    });
  } catch (error) {
    console.error('Error fetching employee:', error);
    return NextResponse.json(
      { error: 'Failed to fetch employee' },
      { status: 500 }
    );
  }
}

// PUT /api/employees/[id] - Update employee
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await checkPermission('masters_employees', 'edit');
    if (error) return error;

    const { id } = await params;
    const body = await request.json();

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

    // Validate roleId if provided
    if (body.roleId) {
      const role = await db.role.findUnique({ where: { id: body.roleId } });
      if (!role) {
        return NextResponse.json(
          { error: 'Invalid role selected' },
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
    const result = await transaction(async (tx) => {
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

      // Build user update data
      const userUpdateData: Record<string, unknown> = {
        name: body.name || existingEmployee.name,
        email: body.email || existingEmployee.email,
        isActive: body.isActive !== undefined ? body.isActive : existingEmployee.isActive,
      };

      if (body.roleId) {
        userUpdateData.roleId = body.roleId;
      }

      if (body.password) {
        userUpdateData.password = await hashPassword(body.password);
      }

      // Update user account if email exists
      if (existingEmployee.email) {
        await tx.user.update({
          where: { email: existingEmployee.email },
          data: userUpdateData,
        });
      }

      // Fetch the updated role name
      const updatedUser = existingEmployee.email
        ? await (tx.user.findUnique as any)({
            where: { email: body.email || existingEmployee.email },
            select: { roleId: true, roleRef: { select: { name: true } } },
          }) as { roleId: string | null; roleRef: { name: string } | null } | null
        : null;

      return { employee, roleId: updatedUser?.roleId, roleName: updatedUser?.roleRef?.name };
    });

    return NextResponse.json({
      ...result.employee,
      roleId: result.roleId || '',
      roleName: result.roleName || 'Unknown',
    });
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
    const { error, session } = await checkPermission('masters_employees', 'edit');
    if (error) return error;

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
    await transaction(async (tx) => {
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
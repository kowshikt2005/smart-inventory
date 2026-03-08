import { NextResponse } from 'next/server';
import { db, transaction } from '@/lib/db';
import { hashPassword, generateEmployeeNumber } from '@/lib/auth-utils';
import { checkPermission } from '@/lib/api-auth';

// GET /api/employees - Get all employees
export async function GET(request: Request) {
  try {
    const { error } = await checkPermission('masters_employees', 'view');
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { employeeNumber: { contains: search, mode: 'insensitive' } },
        { designation: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [employees, total] = await Promise.all([
      db.employee.findMany({
        where,
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
        },
        orderBy: { employeeNumber: 'asc' },
        skip,
        take: limit,
      }),
      db.employee.count({ where }),
    ]);

    // Fetch user → role in a single query (N+1 fix)
    const emails = employees.map(e => e.email).filter((email): email is string => !!email);
    const users: Array<{ email: string; roleRef: { name: string } | null }> = emails.length > 0
      ? await (db.user.findMany as any)({
          where: { email: { in: emails } },
          select: { email: true, roleRef: { select: { name: true } } },
        })
      : [];

    const roleMap = new Map(users.map(u => [u.email, u.roleRef?.name || 'Unknown']));
    const employeesWithRoles = employees.map(employee => ({
      ...employee,
      roleName: employee.email ? (roleMap.get(employee.email) || 'Unknown') : 'Unknown',
    }));

    return NextResponse.json({
      employees: employeesWithRoles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching employees:', error);
    return NextResponse.json(
      { error: 'Failed to fetch employees' },
      { status: 500 }
    );
  }
}

// POST /api/employees - Create new employee
export async function POST(request: Request) {
  try {
    const { error } = await checkPermission('masters_employees', 'edit');
    if (error) return error;

    const body = await request.json();

    // Validate required fields
    const requiredFields = ['name', 'email', 'password', 'roleId'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `${field} is required` },
          { status: 400 }
        );
      }
    }

    // Validate roleId exists
    const role = await db.role.findUnique({
      where: { id: body.roleId },
      select: { id: true, name: true },
    });
    if (!role) {
      return NextResponse.json(
        { error: 'Invalid role selected' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await db.user.findUnique({
      where: { email: body.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 400 }
      );
    }

    // Generate employee number
    const employeeNumber = await generateEmployeeNumber();

    // Hash password
    const hashedPassword = await hashPassword(body.password);

    // Create employee and user in transaction
    const result = await transaction(async (tx) => {
      // Create user account with roleId
      const user = await (tx.user.create as any)({
        data: {
          email: body.email,
          name: body.name,
          password: hashedPassword,
          roleId: body.roleId,
          isActive: true,
        },
      });

      // Create employee record
      const employee = await tx.employee.create({
        data: {
          employeeNumber,
          name: body.name,
          email: body.email,
          phone: body.phone || null,
          designation: body.designation || null,
          department: body.department || null,
          salary: body.salary ? Number(body.salary) : null,
          joinDate: body.joinDate ? new Date(body.joinDate) : new Date(),
          isActive: true,
        },
      });

      return { user, employee };
    });

    return NextResponse.json({
      id: result.employee.id,
      employeeNumber: result.employee.employeeNumber,
      name: result.employee.name,
      email: result.employee.email,
      phone: result.employee.phone,
      designation: result.employee.designation,
      department: result.employee.department,
      salary: result.employee.salary,
      joinDate: result.employee.joinDate,
      roleName: role.name,
      isActive: result.employee.isActive,
      createdAt: result.employee.createdAt,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating employee:', error);
    return NextResponse.json(
      { error: 'Failed to create employee' },
      { status: 500 }
    );
  }
}
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db, transaction } from '@/lib/db';
import { hashPassword, generateEmployeeNumber, hasRole } from '@/lib/auth-utils';

// GET /api/employees - Get all employees (Admin only)
export async function GET(request: Request) {
  try {
    const session = await auth();
    
    if (!session?.user || !hasRole(session.user.role, 'ADMIN')) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

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

    // Fetch all user roles in a single query (fixes N+1 problem)
    const emails = employees.map(e => e.email).filter((email): email is string => !!email);
    const users = emails.length > 0 ? await db.user.findMany({
      where: { email: { in: emails } },
      select: { email: true, role: true },
    }) : [];

    const roleMap = new Map(users.map(u => [u.email, u.role]));
    const employeesWithRoles = employees.map(employee => ({
      ...employee,
      role: employee.email ? (roleMap.get(employee.email) || 'SALESMAN') : 'SALESMAN',
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

// POST /api/employees - Create new employee (Admin only)
export async function POST(request: Request) {
  try {
    const session = await auth();
    
    if (!session?.user || !hasRole(session.user.role, 'ADMIN')) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate required fields
    const requiredFields = ['name', 'email', 'password', 'role'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `${field} is required` },
          { status: 400 }
        );
      }
    }

    // Validate role
    const validRoles = ['SALESMAN', 'BILLING_OPERATOR', 'ACCOUNTANT', 'MANAGER', 'ADMIN'];
    if (!validRoles.includes(body.role)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
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
      // Create user account
      const user = await tx.user.create({
        data: {
          email: body.email,
          name: body.name,
          password: hashedPassword,
          role: body.role,
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

    // Return employee data (without password)
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
      role: body.role,
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
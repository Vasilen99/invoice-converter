import { prisma } from "../../../../../utility/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getUserServer } from "../../../../../utility/get-user-server";

export async function POST(req: NextRequest) {
  try {
    const userClaims = await getUserServer();

    if (!userClaims?.sub) {
      return NextResponse.json(
        {
          alert: {
            status: "error",
            header: "errorMessagesCommon.unauthorizedErrorHeader",
            message: "errorMessagesCommon.unauthorizedErrorMessage",
          },
        },
        { status: 401, headers: { "content-type": "application/json" } },
      );
    }

    const body = await req.json();
    const { accountName, composerName } = body;

    if (!accountName || typeof accountName !== "string" || accountName === "") {
      return NextResponse.json(
        {
          alert: {
            status: "error",
            header: "errorMessagesAccount.accountNameRequired",
            message: "errorMessagesAccount.accountNameRequiredMessage",
          },
        },
        { status: 400, headers: { "content-type": "application/json" } },
      );
    }

    // Get user from database (assuming user already exists)
    const user = await prisma.user.findUnique({
      where: { auth_uid: userClaims.sub },
    });

    if (!user) {
      return NextResponse.json(
        {
          alert: {
            status: "error",
            header: "errorMessagesCommon.userNotFoundHeader",
            message: "errroMessagesCommon.userNotFoundMessage",
          },
        },
        { status: 404, headers: { "content-type": "application/json" } },
      );
    }

    // Check if user already has an account
    const existingAccountMember = await prisma.accountMember.findFirst({
      where: { userId: user.id },
      include: { account: true },
    });

    let account;
    let isCreating = false;

    if (existingAccountMember) {
      // Update existing account
      account = await prisma.account.update({
        where: { id: existingAccountMember.account.id },
        data: { name: accountName, composer_name: composerName },
      });
    } else {
      // Create new account and add user as owner
      account = await prisma.account.create({
        data: {
          name: accountName,
          composer_name: composerName,
          creditBalance: 0,
          members: {
            create: {
              userId: user.id,
              role: "OWNER",
            },
          },
        },
      });
      isCreating = true;
    }

    return NextResponse.json(
      {
        alert: {
          status: "success",
          header: isCreating
            ? "successMessagesAccount.successCreationHeader"
            : "successMessagesAccount.successUpdateHeader",
          message: isCreating
            ? "successMessagesAccount.successCreationMessage"
            : "successMessagesAccount.successUpdateMessage",
        },
        data: account,
      },
      { status: 200, headers: { "content-type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in account creation/update:", error);
    return NextResponse.json(
      {
        alert: {
          status: "error",
          header: "Server Error",
          message: "Failed to process account request",
        },
      },
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
}

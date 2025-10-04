/** @format */

import { RedirectToSignUp, SignedIn } from '@daveyplate/better-auth-ui';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { DynamicBreadcrumb } from '@/components/layout/dynamic-breadcrumb';
import { ModeToggle } from '@/components/layout/mode-toggle';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { NotificationProvider } from '@/contexts/NotificationContext';

import { Separator } from '@/components/ui/separator';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import GithubIcon from '@/components/icons/github-icon';
import { requireRole } from '@/helpers/authGuard';
export default async function ProtectedPage({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(['admin', 'super-admin'], '/unauthorized');
  return (
    <>
      <RedirectToSignUp />
      <SignedIn>
        <NotificationProvider>
          <SidebarProvider defaultOpen={false}>
            <AppSidebar />
            <SidebarInset>
              <div className='@container'>
                <div className='mx-auto w-full'>
                  <header className='flex flex-wrap items-center gap-3 border-b p-3 transition-all ease-linear'>
                    <div className='flex flex-1 items-center gap-2'>
                      <SidebarTrigger className='rounded-full' />
                      <div className='max-lg:hidden lg:contents'>
                        <Separator
                          orientation='vertical'
                          className='me-2 data-[orientation=vertical]:h-4'
                        />
                        <DynamicBreadcrumb />
                      </div>
                    </div>
                    {/* Right side */}
                    <NotificationBell />
                    <Button
                      asChild
                      variant='outline'
                      size='sm'
                      className='font-semibold'>
                      <Link
                        href='https://github.com/indieceo/Indiesaas'
                        target='_blank'
                        aria-label='Clone Now'>
                        <GithubIcon className='mr-2 size-4 fill-foreground' />
                        Clone
                      </Link>
                    </Button>
                    <ModeToggle />
                  </header>
                  <div className='overflow-hidden'>
                    <div className='container p-6'>{children}</div>
                  </div>
                </div>
              </div>
            </SidebarInset>
          </SidebarProvider>
        </NotificationProvider>
      </SignedIn>
    </>
  );
}

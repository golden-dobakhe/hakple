'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { LoginMemberContext, User, createEmptyMember } from '@/stores/auth/loginMember'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import MobileBottomNav from '@/components/MobileBottomNav'
import { useRouter, usePathname } from "next/navigation"
import { initDOMErrorPrevention } from '@/utils/domErrorFix'
import { fetchApi } from '@/utils/api'

export function ClientLayout({ children }: { children: React.ReactNode }) {
    const [loginMember, _setLoginMember] = useState<User>(createEmptyMember());
    const [isLogin, setIsLogin] = useState(false);
    const [isLoginMemberPending, setLoginMemberPending] = useState(true);

    const router = useRouter()
    const [profileImageFetchAttempted, setProfileImageFetchAttempted] = useState(false);

    const setLoginMember = useCallback((member: BackendUser) => {
        console.group('ClientLayout - setLoginMember')

        const nickname = member.nickName ?? (typeof member.nickname === 'string' ? member.nickname : '') ?? '';
        const academyCode = member.academyCode ?? member.academyId ?? '';
        let profileImageUrl = '';
        if (typeof member.profileImageUrl === 'string') {
             profileImageUrl = member.profileImageUrl.trim();
        }

        const user: User = {
            id: member.id ?? member.memberId,
            nickname: nickname,
            userName: member.userName ?? '',
            phoneNum: member.phoneNum,
            creationTime: member.creationTime || '',
            modificationTime: member.modificationTime || '',
            academyCode: academyCode,
            academyName: member.academyName || '',
            profileImageUrl: profileImageUrl,
            isAdmin: member.isAdmin
        };

        _setLoginMember(user);
        const isValidLogin = !!user.userName || !!user.nickname;
        setIsLogin(isValidLogin);

        console.groupEnd();
    }, []);

    const setNoLoginMember = useCallback(() => {

        _setLoginMember(createEmptyMember());
        setIsLogin(false);
    }, []);

    const logout = useCallback((callback: () => void) => {

        fetchApi(`/api/v1/auth/logout`, { method: 'DELETE' }, true)
            .then(() => console.log(''))
            .catch(err => console.error('로그아웃 API 호출 중 오류 발생:', err))
            .finally(() => {
                setNoLoginMember();

                if (typeof window !== 'undefined') {
                    localStorage.removeItem('academyCode');
                    localStorage.removeItem('academyName');
                }
                callback();
            });
    }, [setNoLoginMember]);

    const logoutAndHome = useCallback(() => {

        logout(() => {
            window.location.href = '/';
        });
    }, [logout]);

    const checkAdminAndRedirect = useCallback(async () => {

        try {
            const response = await fetchApi(`/api/v1/admin/check`, { method: 'GET' }, true);
            if (!response.ok) return false;
            const data = await response.json();
            return data === true;
        } catch {
            return false;
        }
    }, []);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            initDOMErrorPrevention();
        }
    }, []);

    const loginMemberContextValue = useMemo(() => ({
        loginMember,
        setLoginMember,
        setNoLoginMember,
        isLoginMemberPending,
        isLogin,
        setIsLogin,
        logout,
        logoutAndHome,
        checkAdminAndRedirect
    }), [
        loginMember, setLoginMember, setNoLoginMember, isLoginMemberPending, isLogin, setIsLogin,
        logout, logoutAndHome, checkAdminAndRedirect
    ]);

    const pathname = usePathname()

    const hideHeaderFooterPages = [
        '/login',
        '/signup',
        '/forgot-username',
        '/forgot-password',
        '/reset-password',
        '/customer',
        '/terms'
    ]

    const shouldHideHeaderFooter = hideHeaderFooterPages.some(page =>
        pathname?.startsWith(page)
    )
    const shouldHideFooter = pathname === '/' || shouldHideHeaderFooter;


    const publicPages = ['/login', '/signup', '/', '/about', '/signup/success','/forgot-username','/forgot-password','/reset-password', '/home', '/terms','/customer']
    const protectedPaths = ['/myinfo', '/my-posts', '/my-comments', '/my-likes']


    useEffect(() => {
        const checkLoginAndHandleRedirect = async () => {
            setLoginMemberPending(true);
            let isLoggedIn = false;
            let userData = null;

            try {

                const response = await fetchApi('/api/v1/auth/me', { method: 'GET' }, true);
                isLoggedIn = response.ok;

                if (isLoggedIn) {
                    userData = await response.json();
                    setLoginMember(userData);

                } else {
                    setNoLoginMember();

                }
            } catch (err) {
                console.error('[ClientLayout] Error checking login status:', err);
                setNoLoginMember();
                isLoggedIn = false;
            } finally {
                 setLoginMemberPending(false);

                 const event = new CustomEvent('loginMemberLoaded')
                 window.dispatchEvent(event)
            }

            const isPublicPage = publicPages.some((page) => pathname?.startsWith(page));
            const isLoginPage = pathname === '/login';
            const isSignupPage = pathname === '/signup';
            const isProtectedPath = protectedPaths.some((path) => pathname?.startsWith(path));



            if (!isLoggedIn) {
                if (isProtectedPath) {

                    router.replace("/login");
                }
                else {

                }
            } else {
                if (isLoginPage || isSignupPage) {

                    router.replace("/home");
                }
                else {
                     console.log('[ClientLayout] Accessing allowed path while logged in.');
                }
            }
        };

        checkLoginAndHandleRedirect();

    }, [pathname, router, setLoginMember, setNoLoginMember]);

    useEffect(() => {
        if (isLogin && !loginMember.profileImageUrl && !profileImageFetchAttempted) {

            setProfileImageFetchAttempted(true);

            const fetchUserInfoAndUpdate = async () => {
                try {
                    const response = await fetchApi('/api/v1/myInfos', { method: 'GET' }, true);

                    if (!response.ok) {
                        console.warn('[ClientLayout] Could not fetch user info to update profile image.');
                        return;
                    }

                    const data = await response.json();

                    if (data.profileImageUrl) {

                        _setLoginMember(prev => ({ ...prev, profileImageUrl: data.profileImageUrl }));
                    } else {

                    }
                } catch(err) {
                    console.error('[ClientLayout] Error fetching user info for profile image:', err);
                }
            };
            fetchUserInfoAndUpdate();
        }

        if (!isLogin && profileImageFetchAttempted) {

            setProfileImageFetchAttempted(false);
        }

    }, [isLogin, loginMember.profileImageUrl, profileImageFetchAttempted, _setLoginMember]);

    if (isLoginMemberPending) {
        return (
            <div className="flex justify-center items-center h-screen">
                로그인 확인 중...
            </div>
        )
    }

    return (
        <LoginMemberContext.Provider value={loginMemberContextValue}>
            <div className="flex flex-col min-h-screen">
                {!shouldHideHeaderFooter && <Header />}
                <div className="flex-grow">{children}</div>
                {!shouldHideFooter && <Footer />}
                {!shouldHideHeaderFooter && <MobileBottomNav />}
            </div>
        </LoginMemberContext.Provider>
    )
}

type BackendUser = {
    id?: number;
    memberId?: number;
    nickName?: string;
    userName?: string;
    phoneNum?: string;
    academyId?: string;
    academyCode?: string;
    academyName?: string;
    profileImageUrl?: string;
    creationTime?: string;
    modificationTime?: string;
    isAdmin?: boolean;
    accessToken?: string;
    nickname?: string;
    [key: string]: unknown;
};

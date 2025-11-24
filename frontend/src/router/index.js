import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'
import MainLayout from '@/layouts/MainLayout.vue'
import Login from '@/views/Login.vue'
import Home from '@/views/Home.vue'
import Explore from '@/views/Explore.vue'
import Profile from '@/views/Profile.vue'
import Admin from '@/views/Admin.vue'

const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: '/login',
            name: 'Login',
            component: Login,
            meta: { guest: true }
        },
        {
            path: '/',
            component: MainLayout,
            meta: { requiresAuth: true },
            children: [
                {
                    path: '',
                    name: 'Home',
                    component: Home
                },
                {
                    path: 'explore',
                    name: 'Explore',
                    component: Explore
                },
                {
                    path: 'profile',
                    name: 'Profile',
                    component: Profile
                },
                {
                    path: 'admin',
                    name: 'Admin',
                    component: Admin,
                    meta: { requiresAdmin: true }
                }
            ]
        }
    ]
})

router.beforeEach((to, from, next) => {
    const userStore = useUserStore()
    const isAuthenticated = userStore.isLoggedIn
    const isAdmin = userStore.isAdmin

    if (to.meta.requiresAuth && !isAuthenticated) {
        next('/login')
    } else if (to.meta.guest && isAuthenticated) {
        next('/')
    } else if (to.meta.requiresAdmin && !isAdmin) {
        next('/')
    } else {
        next()
    }
})

export default router

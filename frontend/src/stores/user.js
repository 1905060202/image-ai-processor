import { defineStore } from 'pinia'
import axios from 'axios'

export const useUserStore = defineStore('user', {
    state: () => ({
        token: localStorage.getItem('token') || '',
        user: {
            username: localStorage.getItem('username') || '',
            role: localStorage.getItem('role') || ''
        },
        credits: 0,
        freeCount: 0
    }),
    getters: {
        isLoggedIn: (state) => !!state.token,
        isAdmin: (state) => state.user.role === 'admin'
    },
    actions: {
        async login(username, password) {
            const response = await axios.post('/api/auth/login', { username, password })
            const { token, username: user, role } = response.data

            this.token = token
            this.user = { username: user, role }

            localStorage.setItem('token', token)
            localStorage.setItem('username', user)
            localStorage.setItem('role', role)

            // Set default auth header
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`

            // Fetch additional info
            await this.fetchUserInfo()
        },

        async fetchUserInfo() {
            try {
                const res = await axios.get('/api/credits/info')
                this.credits = res.data.credits
                this.freeCount = res.data.freeTextToImageCount
            } catch (err) {
                console.error('Failed to fetch user info', err)
            }
        },

        logout() {
            this.token = ''
            this.user = { username: '', role: '' }
            this.credits = 0
            this.freeCount = 0
            localStorage.removeItem('token')
            localStorage.removeItem('username')
            localStorage.removeItem('role')
            delete axios.defaults.headers.common['Authorization']
        }
    }
})

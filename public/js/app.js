document.addEventListener('DOMContentLoaded', () => {
    // -----------------------------------------------------------------
    // 0. Authentication & Token Management
    // -----------------------------------------------------------------
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login';
        return;
    }

    // 获取用户信息
    const username = localStorage.getItem('username') || '用户';
    const role = localStorage.getItem('role') || 'user';
    const isAdmin = role === 'admin';

    // 创建 fetch 包装函数，自动添加 token
    const authenticatedFetch = async (url, options = {}) => {
        // 对于 FormData，不要设置 Content-Type，让浏览器自动设置
        const headers = {};
        if (options.headers) {
            Object.assign(headers, options.headers);
        }
        // 如果不是 FormData，且没有 Content-Type，则设置默认的
        if (!(options.body instanceof FormData)) {
            if (!headers['Content-Type']) {
                headers['Content-Type'] = 'application/json';
            }
        }
        headers['Authorization'] = `Bearer ${token}`;
        
        const response = await fetch(url, { ...options, headers });
        if (response.status === 401 || response.status === 403) {
            // Token 无效，清除并跳转到登录页
            localStorage.removeItem('token');
            localStorage.removeItem('username');
            localStorage.removeItem('role');
            window.location.href = '/login';
            throw new Error('认证失败，请重新登录');
        }
        return response;
    };

    // -----------------------------------------------------------------
    // 1. DOM Element Cache
    // -----------------------------------------------------------------
    const form = document.getElementById('upload-form');
    const imageInput = document.getElementById('image-input');
    const fileLabel = document.getElementById('file-label');
    const fileLabelContent = document.getElementById('file-label-content');
    const promptInput = document.getElementById('prompt-input');
    const originalBox = document.getElementById('original-box');
    const generatedBox = document.getElementById('generated-box');
    const multiPreviewContainer = document.getElementById('multi-preview-container'); 
    const generatedPreview = document.getElementById('generated-preview');
    const downloadLink = document.getElementById('download-link');
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    const submitBtn = document.getElementById('submit-btn');
    const imageListDiv = document.getElementById('image-list');
    const imageUploadSection = document.getElementById('image-upload-section');
    const themeSwitcher = document.getElementById('theme-switcher');
    const modalOverlay = document.getElementById('modal-overlay');
    const modalImage = document.getElementById('modal-image');
    const modalCaption = document.getElementById('modal-caption');
    const modalClose = document.getElementById('modal-close');
    const searchInput = document.getElementById('search-input');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const pageInfoSpan = document.getElementById('page-info');
    const paginationControls = document.getElementById('pagination-controls');
    const keepOriginalCheckbox = document.getElementById('keep-original-checkbox');
    const reusableUploadsContainer = document.getElementById('reusable-uploads-container');
    const reusableUploadsList = document.getElementById('reusable-uploads-list');
    const reusableSearchInput = document.getElementById('reusable-search-input');
    const reusablePrevPageBtn = document.getElementById('reusable-prev-page');
    const reusableNextPageBtn = document.getElementById('reusable-next-page');
    const reusablePageInfoSpan = document.getElementById('reusable-page-info');
    const reusablePaginationControls = document.getElementById('reusable-pagination-controls');
    const providerSelect = document.getElementById('provider-select');
    const sizeSelect = document.getElementById('size-select');
    const creditsValue = document.getElementById('credits-value');
    const freeCountValue = document.getElementById('free-count-value');

    // -----------------------------------------------------------------
    // 2. State Management
    // -----------------------------------------------------------------
    let currentPage = 1;
    let currentFilter = '';
    let selectedReusableImage = null;
    let reusableCurrentPage = 1;
    let reusableCurrentFilter = '';
    

    // -----------------------------------------------------------------
    // 3. Helper Functions
    // -----------------------------------------------------------------
    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    function createActionButton(className, d, title, onClick) {
        const btn = document.createElement('button');
        btn.className = `action-btn btn-${className}`;
        btn.title = title;
        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"></path></svg>`;
        btn.onclick = onClick;
        return btn;
    }

    function setupTheme() {
        const savedTheme = localStorage.getItem('theme') || 'system';
        if (savedTheme === 'dark' || (savedTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }

    function toggleTheme() {
        const isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    }

    function openModal(imageUrl, captionText = '') {
        modalImage.src = imageUrl;
        if (captionText) {
            modalCaption.textContent = captionText;
            modalCaption.style.display = 'block';
        } else {
            modalCaption.style.display = 'none';
        }
        modalOverlay.classList.add('visible');
    }

    function closeModal() {
        modalOverlay.classList.remove('visible');
    }

    function setLoadingState(isLoading) {
        loadingOverlay.classList.toggle('visible', isLoading);
        submitBtn.disabled = isLoading;
        if (isLoading) {
            loadingText.textContent = "AI 正在创作中...";
            generatedPreview.src = '';
            generatedPreview.classList.remove('loaded');
            generatedBox.classList.remove('has-image');
            downloadLink.style.display = 'none';
        }
    }

    function updatePaginationControls(page, totalPages) {
        if (totalPages <= 1) {
            paginationControls.style.display = 'none';
        } else {
            paginationControls.style.display = 'flex';
            pageInfoSpan.textContent = `第 ${page} / ${totalPages} 页`;
            prevPageBtn.disabled = page === 1;
            nextPageBtn.disabled = page >= totalPages;
        }
    }

    function updateGeneratedPreview(url, filename = 'generated.png') {
        generatedPreview.src = url;
        generatedPreview.onload = () => {
            generatedPreview.classList.add('loaded');
            generatedBox.classList.add('has-image');
        };
        downloadLink.href = url;
        downloadLink.download = filename;
        downloadLink.style.display = 'inline-flex';
    }

    function deselectReusableImage() {
        selectedReusableImage = null;
        document.querySelectorAll('.reusable-uploads-list .list-item.selected').forEach(item => item.classList.remove('selected'));
    }

    // ✨ 重构: 完全重写 handleImagePreview 以支持多图
    function handleImagePreview() {
        deselectReusableImage();
        const files = imageInput.files;

        // 清空旧的预览
        const placeholder = multiPreviewContainer.querySelector('.placeholder');
        multiPreviewContainer.innerHTML = '';
        if(placeholder) multiPreviewContainer.appendChild(placeholder); // 把placeholder加回来

        originalBox.classList.toggle('has-image', files.length > 0);

        if (!files || files.length === 0) {
            fileLabelContent.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                <span>点击或拖拽单张/多张图片到这里</span>
                <small>最佳尺寸 1024x1024</small>
            `;
            return;
        }

        fileLabelContent.innerHTML = `<span>已选择 ${files.length} 张图片</span><small>点击或拖拽可替换</small>`;
        
        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = e => {
                const thumbDiv = document.createElement('div');
                thumbDiv.className = 'thumb-preview';
                thumbDiv.title = file.name;
                const img = document.createElement('img');
                img.src = e.target.result;
                img.alt = file.name;
                img.onload = () => img.classList.add('loaded');
                thumbDiv.appendChild(img);
                multiPreviewContainer.appendChild(thumbDiv);
            };
            reader.readAsDataURL(file);
        });
    }
    
    // -----------------------------------------------------------------
    // 4. Core Functions
    // -----------------------------------------------------------------
    async function fetchGeneratedImages(page, query) {
        try {
            const url = new URL('/api/v1/images', window.location.origin);
            url.searchParams.append('page', page);
            if (query) url.searchParams.append('q', query);
            const resp = await authenticatedFetch(url);
            if (!resp.ok) throw new Error('无法连接到服务器');
            const data = await resp.json();
            renderImageList(data.images);
            updatePaginationControls(data.currentPage, data.totalPages);
        } catch (err) {
            console.error('获取图片列表失败:', err);
            imageListDiv.innerHTML = `<p class="error-message">加载失败。</p>`;
        }
    }
    
    async function fetchReusableImages() {
        try {
            const url = new URL('/api/v1/uploads', window.location.origin);
            url.searchParams.append('page', reusableCurrentPage);
            if (reusableCurrentFilter) url.searchParams.append('q', reusableCurrentFilter);
            const resp = await authenticatedFetch(url);
            const data = await resp.json();
            reusableUploadsList.innerHTML = '';
            if (data.images.length > 0) {
                reusableUploadsContainer.style.display = 'block';
                data.images.forEach(createReusableImageListItem);
            } else {
                if (reusableCurrentFilter) {
                    reusableUploadsList.innerHTML = `<p class="placeholder-message">没有找到图片。</p>`;
                } else {
                    reusableUploadsContainer.style.display = 'none';
                }
            }
            updateReusablePagination(data.currentPage, data.totalPages);
        } catch (err) {
            console.error('获取可复用图片失败:', err);
            reusableUploadsContainer.style.display = 'none';
        }
    }
    
    function createReusableImageListItem(image) {
        const item = document.createElement('div');
        item.className = 'list-item';
        if (selectedReusableImage === image.filename) item.classList.add('selected');
        item.dataset.filename = image.filename;
        item.dataset.url = image.url;
        item.onclick = () => selectReusableImage(image.filename, image.url);
        const img = document.createElement('img');
        img.src = image.url;
        img.alt = image.filename;
        img.title = `点击复用: ${image.filename}`;
        const overlay = document.createElement('div');
        overlay.className = 'overlay';
        const buttonsWrapper = document.createElement('div');
        buttonsWrapper.className = 'action-buttons';
        const downloadBtn = document.createElement('a');
        downloadBtn.href = image.url;
        downloadBtn.download = image.filename;
        downloadBtn.className = 'action-btn btn-download';
        downloadBtn.title = '下载图片';
        downloadBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
        downloadBtn.onclick = (e) => e.stopPropagation();
        const renameBtn = createActionButton('rename', 'M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z', '重命名', (e) => {
            e.stopPropagation();
            handleReusableRename(image.filename);
        });
        const deleteBtn = createActionButton('delete', 'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6', '删除', (e) => {
            e.stopPropagation();
            handleReusableDelete(image.filename);
        });
        buttonsWrapper.append(downloadBtn, renameBtn, deleteBtn);
        overlay.appendChild(buttonsWrapper);
        item.append(img, overlay);
        reusableUploadsList.appendChild(item);
    }
    
    function updateReusablePagination(page, totalPages) {
        if (totalPages <= 1) {
            reusablePaginationControls.style.display = 'none';
        } else {
            reusablePaginationControls.style.display = 'flex';
            reusablePageInfoSpan.textContent = `${page} / ${totalPages}`;
            reusablePrevPageBtn.disabled = page === 1;
            reusableNextPageBtn.disabled = page >= totalPages;
        }
    }
    
    async function handleReusableRename(filename) {
        const newNameWithoutExt = prompt(`为 "${filename}" 输入新的文件名:`, filename.substring(0, filename.lastIndexOf('.')));
        if (!newNameWithoutExt || newNameWithoutExt.trim() === '') return;
        try {
            const resp = await authenticatedFetch(`/api/v1/uploads/${filename}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newFilename: newNameWithoutExt.trim() })
            });
            if (!resp.ok) throw new Error('重命名失败');
            // 如果重命名的恰好是当前选中的图片，则更新选中状态
            if (selectedReusableImage === filename) {
                const data = await resp.json();
                selectReusableImage(data.newFilename, `/uploads/permanent/${data.newFilename}`);
            }
            await fetchReusableImages();
        } catch (error) {
            alert(error.message);
        }
    }
    
    async function handleReusableDelete(filename) {
        if (!confirm(`确定要永久删除可复用图片 "${filename}" 吗？`)) return;
        try {
            const resp = await authenticatedFetch(`/api/v1/uploads/${filename}`, { method: 'DELETE' });
            if (!resp.ok) throw new Error('删除失败');
             // 如果删除的恰好是当前选中的图片，则清空预览
            if(selectedReusableImage === filename) {
                handleImagePreview();
            }
            await fetchReusableImages();
        } catch (error) {
            alert(error.message);
        }
    }

    function renderImageList(images) {
        imageListDiv.innerHTML = images.length === 0 ? `<p class="placeholder-message">没有找到图片。</p>` : '';
        images.forEach(createImageListItem);
    }

    function createImageListItem(image) {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.dataset.filename = image.filename; 
        const img = document.createElement('img');
        img.src = image.url;
        img.alt = image.prompt || image.filename;
        img.title = `点击放大预览: ${image.filename}\nPrompt: ${image.prompt || 'N/A'}`;
        img.dataset.action = 'preview'; 
        img.dataset.prompt = image.prompt || image.filename;
        const overlay = document.createElement('div');
        overlay.className = 'overlay';
        const buttonsWrapper = document.createElement('div');
        buttonsWrapper.className = 'action-buttons';
        const downloadBtn = document.createElement('a');
        downloadBtn.href = image.url;
        downloadBtn.download = image.filename;
        downloadBtn.className = 'action-btn btn-download';
        downloadBtn.title = '下载图片';
        downloadBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
        const renameBtn = document.createElement('button');
        renameBtn.className = 'action-btn btn-rename';
        renameBtn.title = '重命名';
        renameBtn.dataset.action = 'rename';
        renameBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>`;
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'action-btn btn-delete';
        deleteBtn.title = '删除';
        deleteBtn.dataset.action = 'delete';
        deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"></path></svg>`;
        buttonsWrapper.append(downloadBtn, renameBtn, deleteBtn);
        overlay.appendChild(buttonsWrapper);
        item.append(img, overlay);
        imageListDiv.appendChild(item);
    }

    // ✨ 修改: 更新 handleFormSubmit 以支持多图
    async function handleFormSubmit(e) {
        e.preventDefault();
        const mode = document.querySelector('input[name="mode"]:checked').value;
        const prompt = promptInput.value.trim();
        const provider = providerSelect?.value || '';
        const size = sizeSelect?.value || '';
        if (mode === 'image-to-image' && imageInput.files.length === 0 && !selectedReusableImage) {
            alert('请至少选择一张图片或复用一张已上传的图片');
            return;
        }
        setLoadingState(true);
        const formData = new FormData();
        formData.append('prompt', prompt);
        // 图生图暂不切换提供方（后端固定使用 Nano），但可以附带字段以便未来扩展
        if (mode === 'image-to-image' && provider) {
            formData.append('provider', provider);
        }
        if (mode === 'image-to-image' && size) {
            formData.append('size', size);
        }
        if (mode === 'image-to-image') {
            if (selectedReusableImage) {
                formData.append('reusableImageFilename', selectedReusableImage);
            } else {
                // 循环附加所有图片
                for (const file of imageInput.files) {
                    formData.append('images', file); // 使用 'images' 作为 key
                }
                formData.append('keepOriginal', keepOriginalCheckbox.checked);
            }
        }
        const endpoint = mode === 'image-to-image' ? '/api/v1/upload' : '/api/v1/generate-text';
        const body = mode === 'image-to-image' ? formData : JSON.stringify({ prompt, provider, size });
        const options = { method: 'POST', body };
        // authenticatedFetch 会自动处理 headers，对于 FormData 不设置 Content-Type
        try {
            const resp = await authenticatedFetch(endpoint, options);
            const data = await resp.json();
            if (!resp.ok) {
                // 如果是积分不足错误，显示更友好的提示
                if (resp.status === 403 && data.error === '积分不足') {
                    alert(`积分不足！\n当前积分: ${data.credits || 0}\n需要积分: ${data.required || 0}\n\n请联系管理员充值积分。`);
                } else {
                    throw new Error(data.message || data.error || '图片生成失败');
                }
                return;
            }
            updateGeneratedPreview(data.generatedUrl);
            
            // 更新积分显示
            if (data.credits !== undefined) {
                if (creditsValue) creditsValue.textContent = data.credits;
            }
            if (data.isFree !== undefined && freeCountValue) {
                // 如果是免费使用，更新免费次数显示
                loadCreditsInfo();
            }
            
            await fetchGeneratedImages(1, '');
            if (mode === 'image-to-image' && (keepOriginalCheckbox.checked || selectedReusableImage)) {
                await fetchReusableImages();
            }
        } catch (err) {
            console.error('生成失败:', err);
            alert('错误: ' + err.message);
        } finally {
            setLoadingState(false);
            // 清除复用图片选择状态
            deselectReusableImage();
            // 清空文件输入
            imageInput.value = '';
            keepOriginalCheckbox.checked = false;
            // 完全重置预览区域（包括复用图片的预览）
            const placeholder = multiPreviewContainer.querySelector('.placeholder');
            multiPreviewContainer.innerHTML = '';
            if (placeholder) {
                multiPreviewContainer.appendChild(placeholder);
            }
            originalBox.classList.remove('has-image');
            // 恢复文件上传提示
            fileLabelContent.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                <span>点击或拖拽单张/多张图片到这里</span>
                <small>最佳尺寸 1024x1024</small>
            `;
        }
    }

    async function handleDelete(filename) {
        if (!confirm(`确定要永久删除图片 "${filename}" 吗？`)) return;
        try {
            const resp = await authenticatedFetch(`/api/v1/images/${filename}`, { method: 'DELETE' });
            if (!resp.ok) {
                const data = await resp.json();
                throw new Error(data.error || '删除失败');
            }
            const itemToRemove = imageListDiv.querySelector(`[data-filename="${filename}"]`);
            itemToRemove?.remove();
        } catch (error) {
            alert('删除失败: ' + error.message);
        }
    }

    async function handleRename(oldFilename) {
        const newNameWithoutExt = prompt(`为 "${oldFilename}" 输入新的文件名 (无需扩展名):`, oldFilename.substring(0, oldFilename.lastIndexOf('.')));
        if (!newNameWithoutExt || newNameWithoutExt.trim() === '') return;
        try {
            const resp = await authenticatedFetch(`/api/v1/images/${oldFilename}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newFilename: newNameWithoutExt.trim() })
            });
            if (!resp.ok) {
                const data = await resp.json();
                throw new Error(data.error || '重命名失败');
            }
            await fetchGeneratedImages(currentPage, currentFilter);
        } catch (error) {
            alert('重命名失败: ' + error.message);
        }
    }

    function handleModeChange(e) {
        const isTextToImage = e.target.value === 'text-to-image';
        imageUploadSection.style.display = isTextToImage ? 'none' : 'flex';
        // 只有在图生图模式，且有可复用图片时才显示
        const hasReusableImages = reusableUploadsList.querySelector('.list-item');
        reusableUploadsContainer.style.display = isTextToImage ? 'none' : (hasReusableImages ? 'block' : 'none');
        imageInput.required = !isTextToImage;
        // 提供方选择在两种模式均可用
    }

    function handleDrop(e) {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            imageInput.files = files;
            handleImagePreview();
        }
    }
    
    // ✨ 修改: 更新 selectReusableImage 以适应新的预览逻辑
    function selectReusableImage(filename, url) {
        if (selectedReusableImage === filename) {
            handleImagePreview();
            return;
        }
        imageInput.value = ''; // 清空新上传的文件
        selectedReusableImage = filename;

        // 更新预览区
        const placeholder = multiPreviewContainer.querySelector('.placeholder');
        multiPreviewContainer.innerHTML = '';
        if(placeholder) multiPreviewContainer.appendChild(placeholder);

        const thumbDiv = document.createElement('div');
        thumbDiv.className = 'thumb-preview';
        const img = document.createElement('img');
        img.src = url;
        img.alt = `复用的图片: ${filename}`;
        img.onload = () => img.classList.add('loaded');
        thumbDiv.appendChild(img);
        multiPreviewContainer.appendChild(thumbDiv);
        originalBox.classList.add('has-image');
        
        fileLabelContent.innerHTML = `<span>复用: ${filename}</span><small>点击或拖拽新图片可替换</small>`;
        document.querySelectorAll('.reusable-uploads-list .list-item').forEach(item => {
            item.classList.toggle('selected', item.dataset.filename === filename);
        });
    }
    // -----------------------------------------------------------------
    // 5. Initializers & Event Listeners
    // -----------------------------------------------------------------
    function initialize() {
        setupTheme();
        
        // 显示用户信息
        const usernameDisplay = document.getElementById('username-display');
        const roleBadge = document.getElementById('role-badge');
        const logoutBtn = document.getElementById('logout-btn');
        const adminBtn = document.getElementById('admin-btn');
        
        if (usernameDisplay) {
            usernameDisplay.textContent = username;
        }
        if (roleBadge) {
            roleBadge.textContent = isAdmin ? '管理员' : '用户';
            if (isAdmin) {
                roleBadge.style.background = 'var(--accent-color)';
                roleBadge.style.color = 'white';
            }
        }
        if (adminBtn) {
            adminBtn.style.display = isAdmin ? 'inline-flex' : 'none';
        }
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                localStorage.removeItem('token');
                localStorage.removeItem('username');
                localStorage.removeItem('role');
                window.location.href = '/login';
            });
        }
        
        // 加载积分信息
        loadCreditsInfo();
        
        fetchGeneratedImages(currentPage, currentFilter);
        fetchReusableImages();

        themeSwitcher.addEventListener('click', toggleTheme);
        modalClose.addEventListener('click', closeModal);
        modalOverlay.addEventListener('click', (e) => e.target === modalOverlay && closeModal());
        document.addEventListener('keydown', (e) => e.key === "Escape" && modalOverlay.classList.contains('visible') && closeModal());
        // ✨ 修改: 大图预览逻辑稍微调整
        originalBox.addEventListener('click', (e) => {
            // 只在点击图片缩略图时触发
            const clickedImg = e.target.closest('img');
            if (clickedImg) {
                openModal(clickedImg.src, '原始上传图片');
            }
        });
        generatedBox.addEventListener('click', (event) => {
            if (event.target.closest('a.btn')) return;
            if (generatedPreview.src && generatedPreview.classList.contains('loaded')) {
                openModal(generatedPreview.src, 'AI 生成结果');
            }
        });
        
        imageListDiv.addEventListener('click', (event) => {
            const target = event.target;
            const actionTarget = target.closest('[data-action]');
            if (!actionTarget) return;
            const listItem = target.closest('.list-item');
            if (!listItem) return;
            const filename = listItem.dataset.filename;
            const action = actionTarget.dataset.action;
            switch (action) {
                case 'preview':
                    const prompt = actionTarget.dataset.prompt;
                    openModal(actionTarget.src, prompt);
                    break;
                case 'rename':
                    handleRename(filename);
                    break;
                case 'delete':
                    handleDelete(filename);
                    break;
            }
        });

        reusableSearchInput.addEventListener('input', debounce(() => {
            reusableCurrentFilter = reusableSearchInput.value;
            reusableCurrentPage = 1;
            fetchReusableImages();
        }, 300));
    
        reusablePrevPageBtn.addEventListener('click', () => {
            if (reusableCurrentPage > 1) {
                reusableCurrentPage--;
                fetchReusableImages();
            }
        });
    
        reusableNextPageBtn.addEventListener('click', () => {
            if (!reusableNextPageBtn.disabled) {
                reusableCurrentPage++;
                fetchReusableImages();
            }
        });

        document.querySelectorAll('input[name="mode"]').forEach(radio => radio.addEventListener('change', handleModeChange));
        imageInput.addEventListener('change', handleImagePreview);
        form.addEventListener('submit', handleFormSubmit);

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => fileLabel.addEventListener(eventName, e => { e.preventDefault(); e.stopPropagation(); }));
        ['dragenter', 'dragover'].forEach(eventName => fileLabel.addEventListener(eventName, () => fileLabel.classList.add('dragover')));
        ['dragleave', 'drop'].forEach(eventName => fileLabel.addEventListener(eventName, () => fileLabel.classList.remove('dragover')));
        fileLabel.addEventListener('drop', handleDrop);

        searchInput.addEventListener('input', debounce(() => {
            currentFilter = searchInput.value;
            currentPage = 1;
            fetchGeneratedImages(currentPage, currentFilter);
        }, 300));

        prevPageBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                fetchGeneratedImages(currentPage, currentFilter);
            }
        });

        nextPageBtn.addEventListener('click', () => !nextPageBtn.disabled && (currentPage++, fetchGeneratedImages(currentPage, currentFilter)));
    }

    // 加载积分信息
    async function loadCreditsInfo() {
        try {
            const resp = await authenticatedFetch('/api/credits/info');
            if (resp.ok) {
                const data = await resp.json();
                if (creditsValue) {
                    creditsValue.textContent = data.credits || 0;
                }
                if (freeCountValue) {
                    freeCountValue.textContent = `${data.freeTextToImageCount || 0}/5`;
                }
            }
        } catch (err) {
            console.error('加载积分信息失败:', err);
        }
    }

    // 检查文生图权限（在提交前）
    async function checkTextToImagePermission() {
        if (document.querySelector('input[name="mode"]:checked').value !== 'text-to-image') {
            return { allowed: true };
        }
        
        try {
            const resp = await authenticatedFetch('/api/v1/generate-text', {
                method: 'OPTIONS' // 使用 OPTIONS 预检查，但实际我们需要一个专门的检查接口
            });
            // 这里我们会在实际提交时检查，所以先返回允许
            return { allowed: true };
        } catch (err) {
            return { allowed: false, error: err.message };
        }
    }

    initialize();
});
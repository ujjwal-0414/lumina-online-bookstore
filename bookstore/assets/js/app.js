let allBooks = [];
let filteredBooks = [];
let currentFilter = 'all';
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let currentCoupon = localStorage.getItem('currentCoupon') || null;
let currentPage = 1;
let isLoading = false;
let hasMoreBooks = true;
const VALID_COUPONS = {
    'NEWYEAR20': 0.20,
    'HAPPY20DEAL': 0.20,
    'SANTA25OFF': 0.25,
    'ABES50': 0.50,
};
async function fetchBooksFromAPI(page = 1) {
    const subjects = ['fiction', 'science_fiction', 'fantasy', 'mystery', 'romance', 'thriller', 'history', 'biography'];
    const allFetchedBooks = [];
    const limit = 6;
    const offset = (page - 1) * limit;
    try {
        const fetchPromises = subjects.map(async (subject) => {
            const response = await fetch(`https://openlibrary.org/subjects/${subject}.json?limit=${limit}&offset=${offset}`);
            if (!response.ok) return [];
            const data = await response.json();
            if (data.works) {
                return data.works.map(work => ({
                    id: work.key,
                    title: work.title,
                    author: work.authors && work.authors.length > 0 ? work.authors[0].name : 'Unknown Author',
                    category: getCategoryFromSubject(subject),
                    coverUrl: work.cover_id
                        ? `https://covers.openlibrary.org/b/id/${work.cover_id}-L.jpg`
                        : `https://via.placeholder.com/300x450/1e293b/ffffff?text=${encodeURIComponent(work.title)}`,
                    price: (Math.floor((Math.random() * 20 + 9.99) * 90)),
                    description: typeof work.first_sentence === 'string' ? work.first_sentence :
                        (Array.isArray(work.first_sentence) ? work.first_sentence[0] :
                            `A captivating ${subject} book that will keep you engaged from start to finish.`),
                    rating: (Math.random() * 2 + 3).toFixed(1)
                }));
            }
            return [];
        });
        const results = await Promise.all(fetchPromises);
        results.forEach(books => allFetchedBooks.push(...books));
        const uniqueBooksMap = new Map();
        allFetchedBooks.forEach(book => {
            if (!uniqueBooksMap.has(book.id)) {
                uniqueBooksMap.set(book.id, book);
            }
        });
        const uniqueFetchedBooks = Array.from(uniqueBooksMap.values());
        return uniqueFetchedBooks.sort(() => Math.random() - 0.5);
    } catch (error) {
        console.error('Error fetching books:', error);
        return [];
    }
}
function getCategoryFromSubject(subject) {
    const categoryMap = {
        'fiction': 'fiction',
        'science_fiction': 'sci-fi',
        'fantasy': 'fiction',
        'mystery': 'fiction',
        'romance': 'fiction',
        'thriller': 'fiction',
        'history': 'non-fiction',
        'biography': 'non-fiction'
    };
    return categoryMap[subject] || 'fiction';
}
async function loadMoreBooks() {
    if (isLoading || !hasMoreBooks) return;
    isLoading = true;
    const booksGrid = document.getElementById('booksGrid');
    let loader = null;
    if (booksGrid && allBooks.length > 0) {
        loader = document.createElement('div');
        loader.className = 'loading-indicator';
        loader.innerHTML = '<div class="spinner"></div> Loading more books...';
        loader.style.gridColumn = "1 / -1";
        loader.style.textAlign = "center";
        loader.style.padding = "20px";
        booksGrid.appendChild(loader);
    }
    const newBooks = await fetchBooksFromAPI(currentPage);
    if (loader) loader.remove();
    if (newBooks.length === 0) {
        hasMoreBooks = false;
        isLoading = false;
        if (allBooks.length > 0) {
            showToast("You've reached the end of the collection!");
        }
        return;
    }
    const uniqueNewBooks = newBooks.filter(newBook =>
        !allBooks.some(existingBook => existingBook.id === newBook.id)
    );
    if (uniqueNewBooks.length === 0 && newBooks.length > 0) {
        isLoading = false;
        return;
    }
    allBooks.push(...uniqueNewBooks);
    const newFilteredBooks = currentFilter === 'all'
        ? uniqueNewBooks
        : uniqueNewBooks.filter(book => book.category === currentFilter);
    if (currentFilter !== 'all') {
        filteredBooks = allBooks.filter(book => book.category === currentFilter);
    } else {
        filteredBooks = [...allBooks];
    }
    renderBooks(newFilteredBooks, false); 
    currentPage++;
    sessionStorage.setItem('lumina_books', JSON.stringify(allBooks));
    sessionStorage.setItem('lumina_page', currentPage.toString());
    isLoading = false;
}
function handleScroll() {
    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 800) {
        loadMoreBooks();
    }
}
function renderBooks(books, clearGrid = true) {
    const booksGrid = document.getElementById('booksGrid');
    if (!booksGrid) return;
    if (clearGrid) {
        booksGrid.innerHTML = '';
        if (books.length === 0 && !isLoading) {
            booksGrid.innerHTML = '<div class="no-books-message">No books found. Try a different filter!</div>';
            return;
        }
    }
    const booksHTML = books.map(book => {
        const cartItem = cart.find(item => item.id === book.id);
        const qty = cartItem ? cartItem.quantity : 0;
        const actionHtml = qty > 0
            ? `<div class="quantity-controls" style="padding: 2px 8px;">
                 <button class="qty-btn" onclick="updateCardQuantity('${book.id}', -1)">-</button>
                 <span class="qty-value">${qty}</span>
                 <button class="qty-btn" onclick="updateCardQuantity('${book.id}', 1)">+</button>
               </div>`
            : `<button class="btn btn-primary btn-small add-to-cart-btn" onclick="addToCart('${book.id}')">
                 Add to Cart
               </button>`;
        return `
        <div class="book-card" data-category="${book.category}" data-book-id="${book.id}" data-quantity="1">
            <div class="book-image-container">
                <img src="${book.coverUrl}" alt="${book.title}" class="book-image" loading="lazy">
                <div class="book-overlay">
                    <button class="btn btn-secondary btn-small view-details-btn" onclick="openBookModal('${book.id}')">
                        View Details
                    </button>
                </div>
            </div>
            <div class="book-info">
                <span class="book-category">${book.category}</span>
                <h3 class="book-title">${truncateText(book.title, 50)}</h3>
                <p class="book-author">${book.author}</p>
                <div class="book-footer" id="footer-${book.id}">
                    <span class="book-price">₹${book.price}</span>
                    ${actionHtml}
                </div>
            </div>
        </div>
    `}).join('');
    if (clearGrid) {
        booksGrid.innerHTML = booksHTML;
    } else {
        booksGrid.insertAdjacentHTML('beforeend', booksHTML);
    }
}
function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}
function filterBooks(category) {
    currentFilter = category;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.filter === category) {
            btn.classList.add('active');
        }
    });
    if (category === 'all') {
        filteredBooks = [...allBooks];
    } else {
        filteredBooks = allBooks.filter(book => book.category === category);
    }
    renderBooks(filteredBooks, true);
    const booksGrid = document.getElementById('booksGrid');
    if (booksGrid) {
        booksGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const searchSuggestions = document.getElementById('searchSuggestions');
    if (!searchInput || !searchBtn || !searchSuggestions) return;
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim().toLowerCase();
        if (query.length < 2) {
            searchSuggestions.style.display = 'none';
            return;
        }
        searchTimeout = setTimeout(() => {
            const suggestions = allBooks
                .filter(book =>
                    book.title.toLowerCase().includes(query) ||
                    book.author.toLowerCase().includes(query)
                )
                .slice(0, 5);
            if (suggestions.length > 0) {
                searchSuggestions.innerHTML = suggestions.map(book => `
                    <div class="suggestion-item" onclick="selectBook('${book.id}')">
                        <img src="${book.coverUrl}" alt="${book.title}" class="suggestion-thumb"> <!-- Changed class from suggestion-image to suggestion-thumb to match CSS -->
                        <div class="suggestion-info">
                            <div class="suggestion-title">${book.title}</div>
                            <div class="suggestion-author">${book.author}</div>
                        </div>
                    </div>
                `).join('');
                searchSuggestions.style.display = 'block';
            } else {
                searchSuggestions.style.display = 'none';
            }
        }, 300);
    });
    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchSuggestions.contains(e.target)) {
            searchSuggestions.style.display = 'none';
        }
    });
}
function performSearch() {
    const searchInput = document.getElementById('searchInput');
    const query = searchInput.value.trim().toLowerCase();
    if (query.length === 0) {
        filterBooks(currentFilter);
        return;
    }
    const results = allBooks.filter(book =>
        book.title.toLowerCase().includes(query) ||
        book.author.toLowerCase().includes(query)
    );
    renderBooks(results);
    document.getElementById('searchSuggestions').style.display = 'none';
    showToast(`Found ${results.length} book${results.length !== 1 ? 's' : ''} matching "${query}"`);
}
function selectBook(bookId) {
    document.getElementById('searchSuggestions').style.display = 'none';
    openBookModal(bookId);
}
function openBookModal(bookId) {
    const book = allBooks.find(b => b.id === bookId);
    if (!book) return;
    document.getElementById('modalImage').src = book.coverUrl;
    document.getElementById('modalImage').alt = book.title;
    document.getElementById('modalCategory').textContent = book.category;
    document.getElementById('modalTitle').textContent = book.title;
    document.getElementById('modalAuthor').textContent = book.author;
    document.getElementById('modalDescription').textContent = book.description;
    document.getElementById('modalPrice').textContent = `₹${book.price}`;
    const modalAddToCartBtn = document.getElementById('modalAddToCart');
    modalAddToCartBtn.onclick = () => {
        addToCart(bookId);
        closeBookModal();
    };
    document.getElementById('bookModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}
function closeBookModal() {
    document.getElementById('bookModal').classList.remove('active');
    document.body.style.overflow = '';
}
function addToCart(bookId) {
    const book = allBooks.find(b => b.id === bookId);
    if (!book) return;
    const existingItem = cart.find(item => item.id === bookId);
    if (existingItem) {
        if (existingItem.quantity >= 15) {
            showToast('Out of Stock (Max 15 allowed)');
            return;
        }
        existingItem.quantity += 1;
        showToast(`Increased quantity of "${book.title}" in cart`);
    } else {
        cart.push({
            ...book,
            quantity: 1
        });
        showToast(`"${book.title}" added to cart!`);
    }
    updateCartCount();
    saveCart();
    updateCardUI(bookId);
}
function updateCardQuantity(bookId, change) {
    const itemIndex = cart.findIndex(item => item.id === bookId);
    if (itemIndex === -1) return;
    const item = cart[itemIndex];
    if (change > 0 && item.quantity >= 15) {
        showToast('Out of Stock (Max 15 allowed)');
        return;
    }
    item.quantity += change;
    if (item.quantity <= 0) {
        const title = item.title;
        cart.splice(itemIndex, 1);
        showToast(`${title} removed from cart`);
    } else {
        if (change > 0) {
            showToast(`${item.title} quantity increased to ${item.quantity}`);
        } else {
            showToast(`${item.title} quantity decreased to ${item.quantity}`);
        }
    }
    saveCart();
    updateCartCount();
    updateCardUI(bookId);
}
function updateCardUI(bookId) {
    const footer = document.getElementById(`footer-${bookId}`);
    if (!footer) return;
    const item = cart.find(i => i.id === bookId);
    const qty = item ? item.quantity : 0;
    const actionContainer = footer.lastElementChild;
    let newActionHtml = '';
    if (qty > 0) {
        newActionHtml = `
            <div class="quantity-controls" style="padding: 2px 8px;">
                <button class="qty-btn" onclick="updateCardQuantity('${bookId}', -1)">-</button>
                <span class="qty-value">${qty}</span>
                <button class="qty-btn" onclick="updateCardQuantity('${bookId}', 1)">+</button>
            </div>
        `;
    } else {
        newActionHtml = `
            <button class="btn btn-primary btn-small add-to-cart-btn" onclick="addToCart('${bookId}')">
                Add to Cart
            </button>
        `;
    }
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = newActionHtml;
    const newElement = tempDiv.firstElementChild;
    if (actionContainer && !actionContainer.classList.contains('book-price')) {
        footer.replaceChild(newElement, actionContainer);
    } else {
        footer.appendChild(newElement);
    }
}
function updateCartCount() {
    const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
    document.getElementById('cartCount').textContent = cartCount;
}
function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
}
function removeFromCart(bookId) {
    const item = cart.find(i => i.id === bookId);
    const title = item ? item.title : 'Item';
    cart = cart.filter(item => item.id !== bookId);
    saveCart();
    updateCartCount();
    renderCartPage();
    showToast(`${title} removed from cart`);
}
function updateCartQuantity(bookId, change) {
    const item = cart.find(i => i.id === bookId);
    if (item) {
        if (change > 0 && item.quantity >= 15) {
            showToast('Out of Stock (Max 15 allowed)');
            return;
        }
        item.quantity += change;
        if (item.quantity <= 0) {
            removeFromCart(bookId);
            return;
        }
        if (change > 0) {
            showToast(`${item.title} quantity increased to ${item.quantity}`);
        } else {
            showToast(`${item.title} quantity decreased to ${item.quantity}`);
        }
        saveCart();
        updateCartCount();
        renderCartPage();
    }
}
function clearCart() {
    cart = [];
    saveCart();
    updateCartCount();
    renderCartPage();
    showToast('Cart cleared');
}
function renderCartPage() {
    const cartPageItems = document.getElementById('cartPageItems');
    if (!cartPageItems) return;
    const cartSubtotal = document.getElementById('cartSubtotal');
    const cartPageTotal = document.getElementById('cartPageTotal');
    if (cart.length === 0) {
        cartPageItems.innerHTML = `
            <div class="empty-state">
                <p>Your cart is currently empty.</p>
                <a href="../index.html" class="btn btn-primary" style="margin-top: 1rem;">Start Shopping</a>
            </div>
        `;
        if (cartSubtotal) cartSubtotal.textContent = '₹0.00';
        if (cartPageTotal) cartPageTotal.textContent = '₹0.00';
        if (currentCoupon) {
            currentCoupon = null;
            localStorage.removeItem('currentCoupon');
        }
        const discountRow = document.getElementById('discountRow');
        if (discountRow) discountRow.style.display = 'none';
        const couponInput = document.getElementById('couponInput');
        if (couponInput) couponInput.value = '';
        return;
    }
    let total = 0;
    const itemsHtml = cart.map(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        return `
            <div class="cart-item">
                <img src="${item.coverUrl}" alt="${item.title}" class="cart-item-image">
                <div class="cart-item-details">
                    <h3 class="cart-item-title">${item.title}</h3>
                    <p class="cart-item-author">${item.author}</p>
                    <span class="cart-item-price">₹${item.price}</span>
                </div>
                <div class="cart-item-actions">
                    <div class="quantity-controls">
                        <button class="qty-btn" onclick="updateCartQuantity('${item.id}', -1)">-</button>
                        <span class="qty-value">${item.quantity}</span>
                        <button class="qty-btn" onclick="updateCartQuantity('${item.id}', 1)">+</button>
                    </div>
                    <button class="remove-btn" onclick="removeFromCart('${item.id}')">&times;</button>
                </div>
            </div>
        `;
    }).join('');
    cartPageItems.innerHTML = `
        <div class="cart-items-header">
            <span class="cart-count-label">${cart.length} Item${cart.length !== 1 ? 's' : ''} in Cart</span>
            <button onclick="clearCart()" class="clear-cart-btn">Clear Cart</button>
        </div>
        ${itemsHtml}
    `;
    const discountRow = document.getElementById('discountRow');
    const discountAmountEl = document.getElementById('discountAmount');
    let discount = 0;
    if (currentCoupon && VALID_COUPONS[currentCoupon]) {
        discount = total * VALID_COUPONS[currentCoupon];
    }
    const finalTotal = total - discount;
    if (cartSubtotal) cartSubtotal.textContent = `₹${total.toFixed(2)}`;
    if (cartPageTotal) cartPageTotal.textContent = `₹${finalTotal.toFixed(2)}`;
    if (discount > 0 && discountRow && discountAmountEl) {
        discountRow.style.display = 'flex';
        discountRow.style.alignItems = 'center';
        discountAmountEl.innerHTML = `
            -₹${discount.toFixed(2)} (${currentCoupon})
            <button onclick="removeCoupon()" class="remove-coupon-btn" aria-label="Remove coupon">
                &times;
            </button>
        `;
    } else if (discountRow) {
        discountRow.style.display = 'none';
    }
}
function removeCoupon() {
    currentCoupon = null;
    localStorage.removeItem('currentCoupon');
    renderCartPage();
    showToast('Coupon removed');
}
function applyCoupon() {
    const input = document.getElementById('couponInput');
    if (!input) return;
    const code = input.value.trim();
    if (!code) {
        showToast('Please enter a coupon code.');
        return;
    }
    if (VALID_COUPONS.hasOwnProperty(code)) {
        currentCoupon = code;
        localStorage.setItem('currentCoupon', code);
        renderCartPage();
        showToast(`Coupon "${code}" applied!`);
        input.value = ''; 
    } else {
        showToast('Invalid coupon code.');
        currentCoupon = null;
        localStorage.removeItem('currentCoupon');
        renderCartPage();
    }
}
function setupSettings() {
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettings = document.getElementById('closeSettings');
    const themeInputs = document.querySelectorAll('input[name="theme"]');
    const notificationCheckbox = document.querySelector('.settings-body .switch input[type="checkbox"]');
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    document.querySelector(`input[value="${savedTheme}"]`).checked = true;
    const notificationsEnabled = localStorage.getItem('notifications') !== 'false'; 
    if (notificationCheckbox) {
        notificationCheckbox.checked = notificationsEnabled;
    }
    settingsBtn.addEventListener('click', () => {
        settingsModal.classList.add('active');
    });
    closeSettings.addEventListener('click', () => {
        settingsModal.classList.remove('active');
    });
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.classList.remove('active');
        }
    });
    themeInputs.forEach(input => {
        input.addEventListener('change', (e) => {
            const theme = e.target.value;
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);
            showToast(`Theme changed to ${theme} mode`);
        });
    });
    if (notificationCheckbox) {
        notificationCheckbox.addEventListener('change', (e) => {
            const enabled = e.target.checked;
            localStorage.setItem('notifications', enabled);
            if (enabled) {
                showToast('Notifications enabled');
            }
        });
    }
}
function showToast(message, duration = 3000) {
    if (localStorage.getItem('notifications') === 'false') return;
    const toastContainer = document.getElementById('toastContainer');
    while (toastContainer.children.length >= 2) {
        toastContainer.removeChild(toastContainer.firstChild);
    }
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}
async function initializeApp() {
    const isHomePage = !!document.getElementById('booksGrid');
    const isCartPage = !!document.getElementById('cartPageItems');
    setupSettings();
    let cartModified = false;
    cart = cart.map(item => {
        const p = parseFloat(item.price);
        if (p < 100) {
            cartModified = true;
            return { ...item, price: Math.floor(p * 90) };
        }
        return item;
    });
    if (cartModified) {
        saveCart();
    }
    updateCartCount();
    const applyCouponBtn = document.getElementById('applyCouponBtn');
    if (applyCouponBtn) {
        applyCouponBtn.addEventListener('click', applyCoupon);
    }
    const closeModal = document.getElementById('closeModal');
    const bookModal = document.getElementById('bookModal');
    if (closeModal && bookModal) {
        closeModal.addEventListener('click', closeBookModal);
        bookModal.addEventListener('click', (e) => {
            if (e.target.id === 'bookModal') closeBookModal();
        });
    }
    const checkoutBtn = document.getElementById('checkoutBtn');
    const checkoutModal = document.getElementById('checkoutModal');
    const closeCheckout = document.getElementById('closeCheckout');
    const checkoutForm = document.getElementById('checkoutForm');
    if (checkoutBtn && checkoutModal && closeCheckout) {
        checkoutBtn.addEventListener('click', () => {
            if (cart.length === 0) {
                showToast('Your cart is empty!');
                return;
            }
            checkoutModal.classList.add('active');
        });
        closeCheckout.addEventListener('click', () => {
            checkoutModal.classList.remove('active');
        });
        if (checkoutForm) {
            checkoutForm.addEventListener('submit', (e) => {
                e.preventDefault();
                showToast('Order placed successfully! Thank you.');
                cart = [];
                saveCart();
                updateCartCount();
                renderCartPage();
                checkoutModal.classList.remove('active');
            });
        }
    }
    if (isHomePage) {
        const cachedBooks = sessionStorage.getItem('lumina_books');
        const cachedPage = sessionStorage.getItem('lumina_page');
        if (cachedBooks && JSON.parse(cachedBooks).length > 0) {
            allBooks = JSON.parse(cachedBooks);
            currentPage = cachedPage ? parseInt(cachedPage) : 2;
            filteredBooks = [...allBooks];
            renderBooks(filteredBooks);
        } else {
            await loadMoreBooks();
        }
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                filterBooks(btn.dataset.filter);
            });
        });
        window.addEventListener('scroll', handleScroll);
    }
    setupSearch();
    if (isCartPage) {
        renderCartPage();
    }
    if (isHomePage) {
        setTimeout(() => {
            showToast('Welcome to Lumina Bookstore! 📚');
        }, 500);
    }
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
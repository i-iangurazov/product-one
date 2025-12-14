export type Language = 'en' | 'ru' | 'kg';

type Translations = {
  add: string;
  addToCart: string;
  callWaiter: string;
  cart: string;
  commentPlaceholder: string;
  connectHint: string;
  connectTitle: string;
  connected: string;
  currency: string;
  empty: string;
  errorGeneric: string;
  menu: string;
  menuHint: string;
  menuLoadFailed: string;
  modifiersOptional: string;
  modifiersRequired: string;
  noOrders: string;
  nothingToPay: string;
  offline: string;
  offlineHint: string;
  orderNumber: string;
  orderReady: string;
  orderSent: string;
  orderStatus: string;
  pay: string;
  payFull: string;
  paySelected: string;
  payThis: string;
  payingInProgress: string;
  paymentConfirmed: string;
  paymentCreateFailed: string;
  paymentCreated: string;
  payments: string;
  peoplePlaceholder: string;
  reason: string;
  requestBill: string;
  sendToKitchen: string;
  sessionClosed: string;
  splitEven: string;
  start: string;
  table: string;
  toPay: string;
  total: string;
  waiterNotified: string;
  signIn: string;
  email: string;
  password: string;
  roleKitchen: string;
  kitchen: string;
  refresh: string;
  newOrders: string;
  acceptOrder: string;
  acceptedOrders: string;
  startCooking: string;
  inProgressOrders: string;
  readyAction: string;
  readyOrders: string;
  roleWaiter: string;
  readyServeTitle: string;
  guestCalls: string;
  noCalls: string;
  readyListEmpty: string;
  markServed: string;
};

const base: Translations = {
  add: 'Add',
  addToCart: 'Add to cart',
  callWaiter: 'Call waiter',
  cart: 'Cart',
  commentPlaceholder: 'Comment for the kitchen',
  connectHint: 'Tap start to join the table session',
  connectTitle: 'Connect to table',
  connected: 'Connected',
  currency: 'KGS',
  empty: 'Nothing here yet',
  errorGeneric: 'Something went wrong',
  menu: 'Menu',
  menuHint: 'Pick dishes to add to your cart',
  menuLoadFailed: 'Failed to load menu',
  modifiersOptional: 'Optional',
  modifiersRequired: 'Required',
  noOrders: 'No orders yet',
  nothingToPay: 'Nothing to pay',
  offline: 'Offline mode',
  offlineHint: 'Check connection and try again',
  orderNumber: 'Order',
  orderReady: 'Order ready',
  orderSent: 'Order sent',
  orderStatus: 'Order status',
  pay: 'Pay',
  payFull: 'Pay full amount',
  paySelected: 'Pay selected items',
  payThis: 'Pay this item',
  payingInProgress: 'Processing payment…',
  paymentConfirmed: 'Payment confirmed',
  paymentCreateFailed: 'Failed to create payment',
  paymentCreated: 'Payment created',
  payments: 'Payments',
  peoplePlaceholder: 'Guests count',
  reason: 'Reason',
  requestBill: 'Request bill',
  sendToKitchen: 'Send to kitchen',
  sessionClosed: 'Session closed',
  splitEven: 'Split evenly',
  start: 'Start',
  table: 'Table',
  toPay: 'To pay',
  total: 'Total',
  waiterNotified: 'Waiter notified',
  signIn: 'Sign in',
  email: 'Email',
  password: 'Password',
  roleKitchen: 'Kitchen',
  kitchen: 'Kitchen',
  refresh: 'Refresh',
  newOrders: 'New orders',
  acceptOrder: 'Accept',
  acceptedOrders: 'Accepted',
  startCooking: 'Start cooking',
  inProgressOrders: 'In progress',
  readyAction: 'Mark ready',
  readyOrders: 'Ready',
  roleWaiter: 'Waiter',
  readyServeTitle: 'Ready to serve',
  guestCalls: 'Guest calls',
  noCalls: 'No calls',
  readyListEmpty: 'Nothing to serve yet',
  markServed: 'Mark served',
};

const translations: Record<Language, Translations> = {
  en: base,
  ru: {
    add: 'Добавить',
    addToCart: 'Добавить в корзину',
    callWaiter: 'Вызвать официанта',
    cart: 'Корзина',
    commentPlaceholder: 'Комментарий для кухни',
    connectHint: 'Нажмите старт, чтобы присоединиться к столу',
    connectTitle: 'Подключение к столу',
    connected: 'Подключено',
    currency: 'сом',
    empty: 'Пока пусто',
    errorGeneric: 'Что-то пошло не так',
    menu: 'Меню',
    menuHint: 'Выберите блюда и добавьте в корзину',
    menuLoadFailed: 'Не удалось загрузить меню',
    modifiersOptional: 'Необязательно',
    modifiersRequired: 'Обязательно',
    noOrders: 'Заказов пока нет',
    nothingToPay: 'Нечего оплачивать',
    offline: 'Нет соединения',
    offlineHint: 'Проверьте интернет и попробуйте снова',
    orderNumber: 'Заказ',
    orderReady: 'Заказ готов',
    orderSent: 'Заказ отправлен',
    orderStatus: 'Статус заказа',
    pay: 'Оплатить',
    payFull: 'Оплатить полностью',
    paySelected: 'Оплатить выбранное',
    payThis: 'Оплатить этот пункт',
    payingInProgress: 'Оплата обрабатывается…',
    paymentConfirmed: 'Оплата подтверждена',
    paymentCreateFailed: 'Не удалось создать оплату',
    paymentCreated: 'Платеж создан',
    payments: 'Платежи',
    peoplePlaceholder: 'Кол-во гостей',
    reason: 'Причина',
    requestBill: 'Попросить счет',
    sendToKitchen: 'Отправить на кухню',
    sessionClosed: 'Сессия закрыта',
    splitEven: 'Разделить поровну',
    start: 'Старт',
    table: 'Стол',
    toPay: 'К оплате',
    total: 'Итого',
    waiterNotified: 'Официант уведомлен',
    signIn: 'Войти',
    email: 'Email',
    password: 'Пароль',
    roleKitchen: 'Кухня',
    kitchen: 'Кухня',
    refresh: 'Обновить',
    newOrders: 'Новые заказы',
    acceptOrder: 'Принять',
    acceptedOrders: 'Принятые',
    startCooking: 'Начать готовить',
    inProgressOrders: 'Готовятся',
    readyAction: 'Готово',
    readyOrders: 'Готовые',
    roleWaiter: 'Официант',
    readyServeTitle: 'Готово к подаче',
    guestCalls: 'Вызовы гостей',
    noCalls: 'Вызовов нет',
    readyListEmpty: 'Нет готовых заказов',
    markServed: 'Отметить подачу',
  },
  kg: {
    add: 'Кошуу',
    addToCart: 'Себетке кошуу',
    callWaiter: 'Официантты чакыруу',
    cart: 'Себет',
    commentPlaceholder: 'Ашкана үчүн комментарий',
    connectHint: 'Столго кошулуу үчүн Старт басыңыз',
    connectTitle: 'Столго кошулуу',
    connected: 'Кошулду',
    currency: 'сом',
    empty: 'Азырынча бош',
    errorGeneric: 'Бир ката кетти',
    menu: 'Меню',
    menuHint: 'Тамактарды тандап себетке кошуңуз',
    menuLoadFailed: 'Меню жүктөлгөн жок',
    modifiersOptional: 'Мажбур эмес',
    modifiersRequired: 'Мажбур',
    noOrders: 'Заказдар жок',
    nothingToPay: 'Төлөй турган нерсе жок',
    offline: 'Туташуу жок',
    offlineHint: 'Интернетти текшерип, кайра аракет кылыңыз',
    orderNumber: 'Заказ',
    orderReady: 'Заказ даяр',
    orderSent: 'Заказ жөнөтүлдү',
    orderStatus: 'Заказ статусу',
    pay: 'Төлөө',
    payFull: 'Толук төлөө',
    paySelected: 'Тандалгандарды төлөө',
    payThis: 'Муну төлөө',
    payingInProgress: 'Төлөм жүргүзүлүүдө…',
    paymentConfirmed: 'Төлөм ырасталды',
    paymentCreateFailed: 'Төлөмдү түзүү мүмкүн эмес',
    paymentCreated: 'Төлөм түзүлдү',
    payments: 'Төлөмдөр',
    peoplePlaceholder: 'Коноктор саны',
    reason: 'Себеби',
    requestBill: 'Эсеп сура',
    sendToKitchen: 'Ашканага жөнөтүү',
    sessionClosed: 'Сессия жабык',
    splitEven: 'Тең бөлүшүү',
    start: 'Старт',
    table: 'Стол',
    toPay: 'Төлөөгө',
    total: 'Жыйынтык',
    waiterNotified: 'Официантка билдирилди',
    signIn: 'Кирүү',
    email: 'Email',
    password: 'Сырсөз',
    roleKitchen: 'Ашкана',
    kitchen: 'Ашкана',
    refresh: 'Жаңыртуу',
    newOrders: 'Жаңы заказдар',
    acceptOrder: 'Кабыл алуу',
    acceptedOrders: 'Кабыл алынгандар',
    startCooking: 'Бышырууну баштоо',
    inProgressOrders: 'Бышырылууда',
    readyAction: 'Даяр',
    readyOrders: 'Даярлар',
    roleWaiter: 'Официант',
    readyServeTitle: 'Берүүгө даяр',
    guestCalls: 'Конок чакыруулары',
    noCalls: 'Чакыруулар жок',
    readyListEmpty: 'Берчү заказдар жок',
    markServed: 'Берилди деп белгилөө',
  },
};

export function getTranslations(lang: Language): Translations {
  return translations[lang] ?? translations.en;
}

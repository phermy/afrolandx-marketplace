import { PAYMENT_EMAIL } from "@shared/payment-contact";
import { REFUND_TIMELINE } from "@shared/customer-support";

export type Policy = {
  slug: string;
  title: string;
  summary: string;
  lastUpdated?: string;
  sections: { heading: string; body: string }[];
};

const contact = "For questions, contact info@afrolandx.com.";
const dates = "Effective date: September 4, 2026 · Last updated: September 4, 2026";

const basePolicies: Policy[] = [
  { slug: "marketplace-terms", title: "Marketplace Terms and Conditions", summary: "The rules for using Afrolandx, placing orders and accessing marketplace protections.", sections: [
    { heading: "About Afrolandx", body: "Afrolandx is a Nigeria-based online marketplace connecting customers with independent vendors. Unless Afrolandx is named as the seller, the vendor sells and supplies the goods. Afrolandx operates the platform, supports payments, verification, shipping and complaints." },
    { heading: "Accounts and acceptable use", body: "Provide accurate information, keep login details and delivery codes secure, and promptly report unauthorised use. False identities, fraud, payment abuse, interference, scraping without permission, fake claims and abusive communications are not allowed." },
    { heading: "Products, prices and orders", body: "Vendors must provide accurate descriptions, photographs, condition, price, stock and delivery information. Prices and material charges are shown before payment. An order acknowledgement does not guarantee acceptance; an order may be cancelled for stock, pricing, fraud, prohibited-goods, delivery or legal reasons." },
    { heading: "Responsibility and contact", body: `Use the policy that applies to your order for shipping, returns, reviews, promotions and complaints. ${contact}` },
  ]},
  { slug: "privacy-and-cookie-policy", title: "Privacy and Cookie Policy", summary: "How Afrolandx handles account, order, vendor and platform information.", sections: [
    { heading: "Information we use", body: "We may use information needed to create accounts, process orders, provide delivery, verify vendors, prevent fraud, answer complaints, improve the service and meet legal obligations." },
    { heading: "Sharing and retention", body: "Information is shared only with relevant vendors, verification agents, logistics and payment providers, professional advisers or authorities where necessary for the stated purpose. We retain information for as long as needed for those purposes and applicable obligations." },
    { heading: "Cookies and choices", body: "Afrolandx may use essential cookies for authentication, security and cart functionality, plus limited analytics where enabled. You can manage cookies in your browser; disabling essential cookies may affect the service." },
    { heading: "Contact", body: contact },
  ]},
  { slug: "shipping-policy", title: "Shipping Policy", summary: "What to expect from dispatch, verification, delivery windows and tracking.", sections: [
    { heading: "Dispatch and verification", body: "Vendors prepare accepted orders within the handling time shown on the listing. Where verification applies, the item is checked before handover to the logistics provider. Tracking or delivery updates are shared when available." },
    { heading: "Delivery", body: "Delivery timing depends on the item, destination, carrier, customs and events outside Afrolandx's control. Customers should provide accurate delivery details and be available for delivery or follow the carrier's instructions." },
    { heading: "Delays and problems", body: "Report a missing, damaged or materially delayed delivery through the order page with the order number and supporting evidence. Keep packaging and communications while the matter is reviewed." },
    { heading: "Contact", body: contact },
  ]},
  { slug: "return-policy", title: "Return Policy", summary: "The process and eligibility guidance for returning an item.", sections: [
    { heading: "Requesting a return", body: "Start a return through the order page as soon as possible, stating the order number, reason and remedy requested. Do not send an item back without the return instructions provided for that order." },
    { heading: "Listing classifications", body: "Each product shows one AfrolandX-approved classification: standard returns accepted, final sale, custom-made item or hygiene-sensitive item. A classification explains change-of-mind eligibility; it does not remove rights that apply to faulty, unsafe, damaged, counterfeit or materially misdescribed goods." },
    { heading: "Condition and evidence", body: "Keep the item, packaging, tags and relevant communications. Items should be returned in the condition required by the listing and return instructions, subject to applicable consumer rights and any disclosed exceptions." },
    { heading: "Review", body: "Afrolandx may request photographs, tracking or other evidence and may involve the vendor, verification agent or carrier. The outcome and any next step will be explained after review." },
    { heading: "Contact", body: contact },
  ]},
  { slug: "complaints-and-dispute-resolution", title: "Complaints and Dispute Resolution Policy", summary: "How to tell Afrolandx what happened, share evidence and request a review.", sections: [
    { heading: "How to complain", body: "Use the order page or email info@afrolandx.com. Include the order number, a clear description, the outcome requested and useful evidence such as messages, photographs, video, receipts or tracking. For an urgent safety issue, stop using the product and mark the complaint urgent." },
    { heading: "Investigation and outcomes", body: "Afrolandx aims to acknowledge complaints within 2 business days and give an outcome within 10 business days. Complex investigations may take longer with updates. Outcomes may include information, listing correction, cancellation, delivery action, repair, replacement, return, review removal, account restriction or referral." },
    { heading: "Internal review", body: "A customer who disagrees may request internal review within 14 calendar days, explaining what was overlooked or providing new evidence. A different authorised person should review where practical." },
  ]},
  { slug: "reviews-and-ratings", title: "Reviews and Ratings Policy", summary: "Standards for useful, honest and experience-based marketplace feedback.", sections: [
    { heading: "What reviews should contain", body: "Reviews should reflect a genuine experience with the relevant order or service and be clear, fair and relevant. Do not submit content that is false, copied, incentivised without disclosure, discriminatory, threatening or unrelated." },
    { heading: "Moderation", body: "Afrolandx may remove or restrict content that breaches this policy, infringes rights, exposes personal information, manipulates ratings or creates a safety or legal concern. A review decision may be explained through the relevant account channel." },
    { heading: "Vendor responses", body: "Vendors may respond professionally and should not reveal customer information, pressure a customer to change a review or offer an improper benefit for a rating." },
    { heading: "Contact", body: contact },
  ]},
  { slug: "promotions-and-vouchers", title: "Promotions and Vouchers Policy", summary: "The terms that keep offers, vouchers and promotional pricing clear.", sections: [
    { heading: "Using an offer", body: "Each promotion or voucher will show its qualifying products, dates, redemption rules and any minimum purchase or account requirements before use. A voucher may be limited to one use, one account or a stated quantity." },
    { heading: "Fair use", body: "Do not create accounts, transactions or cancellations to manipulate an offer, transfer a voucher where prohibited or use a voucher obtained through error or abuse. Afrolandx may refuse or cancel an affected redemption." },
    { heading: "Changes", body: "Afrolandx may end or correct a promotion where needed for security, technical, legal or operational reasons. Any order impact will be handled under the applicable order policies." },
    { heading: "Contact", body: contact },
  ]},
  { slug: "prohibited-and-restricted-products", title: "Prohibited and Restricted Products Policy", summary: "Products and listings that cannot be offered, or need additional controls.", sections: [
    { heading: "Prohibited listings", body: "Listings must not offer counterfeit or stolen goods, unsafe or recalled products, illegal goods, weapons, controlled substances, exploitative material or anything that infringes another person's rights or applicable law." },
    { heading: "Restricted listings", body: "Some products may require age, authenticity, safety, licensing, origin or other checks before they can be listed or shipped. Vendors must provide accurate information and follow any instructions shown by Afrolandx." },
    { heading: "Enforcement", body: "Afrolandx may remove a listing, hold or cancel an order, restrict an account, request evidence or refer a matter to a responsible provider or authority. Do not relist a removed product without approval." },
    { heading: "Contact", body: contact },
  ]},
  { slug: "product-listing-and-marketplace-standards", title: "Product Listing and Marketplace Standards", summary: "The baseline quality and accuracy standards for every product listing.", sections: [
    { heading: "Accurate listings", body: "Vendors must use truthful titles, photographs, descriptions, measurements, condition, origin, material, price, stock and delivery details. Used or refurbished goods must be clearly identified." },
    { heading: "Presentation", body: "Images and copy should represent the item available for sale and must not mislead customers about brand, authenticity, availability or cultural provenance. Keep listings current and remove unavailable stock." },
    { heading: "Enforcement", body: "Afrolandx may request corrections, pause or remove a listing, cancel an affected transaction or restrict an account where standards are not met." },
    { heading: "Contact", body: contact },
  ]},
  { slug: "vendor-agreement-and-code-of-conduct", title: "Vendor Agreement and Code of Conduct", summary: "The conduct, fulfilment and marketplace responsibilities for Afrolandx vendors.", sections: [
    { heading: "Professional conduct", body: "Vendors must act honestly, lawfully and respectfully, keep information accurate, protect customer data and communicate through the approved marketplace channels." },
    { heading: "Orders and customers", body: "Accept and prepare orders in the stated time, do not substitute without approval, provide accurate dispatch information and cooperate with complaints, returns, verification and investigations." },
    { heading: "Trust and enforcement", body: "Fraud, harassment, discrimination, manipulation, counterfeit goods, off-platform payment pressure and misuse of customer information are prohibited. Afrolandx may warn, restrict, suspend or close an account where reasonably necessary." },
    { heading: "Contact", body: contact },
  ]},
  { slug: "vendor-onboarding-data-and-account-security", title: "Vendor Onboarding, Data and Account Security Policy", summary: "The information, verification and security practices required to sell on Afrolandx.", sections: [
    { heading: "Onboarding and verification", body: "Afrolandx may request identity, ownership, banking, registration, licensing, location and other reasonable compliance information. We may check information with official or trusted sources and request original documents, a call or a site visit." },
    { heading: "Account security", body: "Only authorised people may access a vendor account. Use strong passwords and available security controls, never sell or transfer access without approval, and report suspected compromise immediately." },
    { heading: "Customer data", body: "Customer information may be used only to fulfil, deliver, return, prevent fraud or resolve a complaint about the relevant order. It must not be sold or used for unrelated marketing without a lawful basis and required notice or consent." },
    { heading: "Contact", body: contact },
  ]},
  { slug: "vendor-orders-shipping-returns-and-settlement", title: "Vendor Orders, Shipping, Returns and Settlement Policy", summary: "Operational guidance for fulfilment, the 42-hour cut-off, verification, returns, fees and settlement.", sections: [
    { heading: "Order acceptance and cancellation", body: "Monitor the dashboard, confirm stock and prepare accepted orders within the stated handling time. A customer may request cancellation until the earlier of 42 hours after ordering or the item being received by the Afrolandx verification agent or logistics provider." },
    { heading: "Verification and shipping", body: "Send the correctly packed item with its order reference to the assigned verification agent and keep proof of dispatch. Verification may check identity, quantity, condition, packaging and listing consistency, but does not remove vendor responsibility." },
    { heading: "Returns and evidence", body: "Customer eligibility follows the customer-facing policies. Vendors must respond to a claim within 2 business days or a shorter urgent-safety period, preserve records and provide relevant listing, dispatch, packaging or authenticity evidence." },
    { heading: "Fees and settlement", body: "The dashboard or signed schedule states commission, payment-processing, verification, logistics, storage, advertising and other applicable charges. Vendors remain responsible for applicable taxes, registrations and invoices." },
  ]},
];

const additionalSections: Record<string, { heading: string; body: string }[]> = {
  "marketplace-terms": [
    { heading: "Payments and cancellation", body: "Customers must provide accurate payment information and may cancel only where the order page and applicable policy allow. Afrolandx or the vendor may cancel for stock, pricing, fraud, prohibited-goods, delivery or legal reasons; any amount due back is handled under the applicable customer policy." },
    { heading: "Shipping, returns and refunds", body: "Shipping, returns and any refund eligibility are governed by the current customer-facing policies and the information shown before checkout. Customers must follow return instructions and preserve relevant evidence." },
    { heading: "Content and intellectual property", body: "Users must own or have permission to submit listings, reviews, photographs and other content. Content must not infringe rights, mislead, contain unlawful material or expose another person's private information. Afrolandx may use submitted content to operate and promote the marketplace as permitted by law." },
    { heading: "Responsibility and service availability", body: "Afrolandx provides the marketplace and may rely on vendors, verification agents, carriers and payment providers. The service may change, be interrupted or be restricted for security, maintenance, investigation or legal compliance." },
    { heading: "Complaints, law and contact", body: "Use the Complaints and Dispute Resolution Policy and contact info@afrolandx.com. These terms do not remove rights that cannot lawfully be excluded." },
  ],
  "privacy-and-cookie-policy": [
    { heading: "Who controls your information", body: "Afrolandx is the marketplace operator responsible for information processed through the service. Vendor processing may also be governed by the vendor's own lawful responsibilities." },
    { heading: "Information we collect", body: "This may include identity and contact details, account credentials, delivery details, order and payment references, vendor verification records, messages, reviews, device information, usage data and cookie identifiers." },
    { heading: "Why we use it", body: "We use information to provide accounts and orders, verify identity and vendors, deliver products, prevent fraud and abuse, support customers, improve the service, communicate service information and comply with legal obligations." },
    { heading: "Your rights", body: "Subject to applicable law, you may request access, correction, deletion, restriction or portability, object to certain processing and withdraw consent where consent is the basis. Contact info@afrolandx.com with enough detail to locate the request." },
    { heading: "Children and updates", body: "The marketplace is not directed to children who cannot lawfully use it. We may update this policy when our processing, service or legal obligations change and will show the revised date." },
  ],
  "shipping-policy": [
    { heading: "Who does what", body: "Vendors are responsible for accurate listing, preparation and handover. Afrolandx may coordinate verification, payment and logistics. Customers must provide accurate delivery information and cooperate with delivery attempts and customs requests." },
    { heading: "The 42-hour cancellation rule", body: "A customer may request cancellation until the earlier of 42 hours after ordering or the item reaching the Afrolandx verification agent or logistics provider. After that point, shipping, return and applicable customer remedies govern." },
    { heading: "Delivery times, tracking and delays", body: "Estimated timing depends on destination, handling, verification, carrier, customs and events outside reasonable control. Tracking is supplied when available. Delays should be reported with the order number and evidence." },
    { heading: "Customs and international orders", body: "Customers may be responsible for accurate destination information and charges imposed by destination authorities where applicable. Vendors must provide truthful customs description, value, origin and required documents; no false declaration or undervaluation is permitted." },
    { heading: "Damage, loss or missing items", body: "Report damage, loss or a missing item promptly, keep packaging and take photographs before disposal. Afrolandx may request carrier, vendor, verification and payment evidence and will explain the next step." },
  ],
  "return-policy": [
    { heading: "Who does what", body: "Customers must make a timely request, follow authorisation and packaging instructions and preserve evidence. Vendors must cooperate with inspection and remedies. Afrolandx coordinates the review and may involve carriers or verification agents." },
    { heading: "Change-of-mind returns", body: "Eligible goods may be returned after the cancellation cut-off where this policy and the listing allow it. Eligibility may depend on the item's condition, timing, destination and disclosed exceptions." },
    { heading: "Excluded change-of-mind items", body: "Items may be excluded where they are personalised, made to order, perishable, hygiene-sensitive after unsealing, used or damaged by the customer, or otherwise identified in the listing or applicable law." },
    { heading: "How to return an item", body: "Open the order and select “Request a return”, or contact info@afrolandx.com. Include the order number, reason, preferred outcome and useful photographs or video. Wait for the return ID, approved address, carrier and customs instructions; do not hand the item to a rider, vendor or agent without approval. Package securely, use the nominated tracked service and lodge it within 7 calendar days after approval unless told otherwise. Keep tracking and receipt until closure." },
    { heading: "Inspection and outcome", body: "Afrolandx may inspect condition, authenticity, completeness, damage, packaging and correspondence. The decision may include an approved return, repair, replacement or other remedy required by the circumstances and law; reasons and next steps will be provided." },
    { heading: "Disputes and help", body: "Raise a disagreement through the order page or info@afrolandx.com with new evidence or an explanation of what was overlooked. Genuine legal and consumer rights remain available." },
  ],
  "complaints-and-dispute-resolution": [
    { heading: "Escalation and external complaints", body: "If unresolved after Afrolandx has had a reasonable opportunity to respond, a customer may complain to the Federal Competition and Consumer Protection Commission, the Nigeria Data Protection Commission for privacy matters, a payment provider, or another regulator, tribunal or court with jurisdiction." },
    { heading: "Fair use and contact", body: "Complaints must be genuine and respectful. Afrolandx may restrict abusive, threatening, knowingly false or repeatedly duplicated communications without blocking a genuine legal claim. Complaint support is available at info@afrolandx.com. CAC REG: 7039498." },
  ],
  "reviews-and-ratings": [
    { heading: "Who may submit a review", body: "A customer with a genuine order or service experience may submit a review when the feature is available. Vendors may respond to reviews about their own listings without revealing customer information." },
    { heading: "What is not allowed", body: "Do not submit fake, copied, defamatory, discriminatory, threatening, sexually explicit, private, unlawful, promotional or irrelevant content; manipulate ratings; review your own transaction; coordinate reviews; or offer or accept an improper benefit for a rating." },
    { heading: "Moderation and appeal", body: "Afrolandx may delay, edit for privacy or remove content that breaches this policy or law. Report a review with its link or order details and explanation. A user may request appeal with relevant evidence." },
    { heading: "Ratings and use of content", body: "Ratings may be aggregated and displayed to help customers. By submitting content, you allow Afrolandx to display and use it to operate, moderate and improve the marketplace, subject to applicable rights and law." },
  ],
  "promotions-and-vouchers": [
    { heading: "Using vouchers and discounts", body: "Apply a voucher before payment where instructed. Offers may be limited by account, product, vendor, destination, quantity, date, minimum spend or other stated eligibility. Only one offer may apply where the terms say so." },
    { heading: "Cancellations, returns and refunds", body: "If an order using a promotion is cancelled or returned, the amount paid and any promotional benefit are treated according to the applicable order and return terms. A voucher is not converted to cash unless its stated terms or law require it." },
    { heading: "Fair use, changes and errors", body: "Do not create accounts or transactions to manipulate an offer, transfer a voucher where prohibited, or use an offer obtained through an error. Afrolandx may correct, suspend or end an offer for technical, security, legal or operational reasons." },
    { heading: "Complaints and contact", body: "Send the offer name or code, order number and issue to info@afrolandx.com. Afrolandx may ask for evidence of eligibility and redemption." },
  ],
  "prohibited-and-restricted-products": [
    { heading: "Products that are prohibited", body: "Prohibited listings include counterfeit, stolen, illegal, unsafe, recalled or unlawfully imported goods; weapons and controlled substances; exploitative material; goods infringing rights; and products that cannot lawfully be offered or delivered." },
    { heading: "Antiquities, cultural heritage and provenance", body: "Stolen or looted antiquities, archaeological finds, illegally excavated objects and cultural heritage items obtained, exported or imported unlawfully are prohibited. Before offering an antiquity or cultural heritage object, a vendor must provide verifiable provenance, evidence of lawful ownership and any required export and import permits for Afrolandx review and approval. An unsupported claim of age, origin or authenticity is not sufficient. Items with unverifiable provenance must not be listed. Contemporary crafts and reproductions must be accurately identified and must not be presented as genuine antiquities. Afrolandx may request supporting records, remove listings or refer suspected unlawful trade to the appropriate authorities." },
    { heading: "Restricted products", body: "A restricted product may require age, authenticity, safety, origin, licensing, destination, carrier or other approval. Vendors must supply truthful details and comply with instructions before listing or dispatch." },
    { heading: "Customer and vendor responsibilities", body: "Vendors must check legality, condition, authenticity, safety and destination restrictions. Customers must not misuse products, evade checks or ask a vendor to make a false declaration." },
    { heading: "Orders, reporting and contact", body: "Afrolandx may remove listings, hold or cancel orders, restrict accounts, request evidence or refer matters to an authority. Report a concern promptly at info@afrolandx.com with listing or order details." },
  ],
  "product-listing-and-marketplace-standards": [
    { heading: "Before listing", body: "Vendors must have the right to sell the product, confirm it is lawful and genuine, check restricted-product rules and ensure stock, condition and fulfilment capability are accurate." },
    { heading: "Listing information", body: "Include truthful title, photographs, measurements, materials, origin, condition, brand, authenticity, included items, price, stock, handling and delivery details. Used or refurbished goods must be clearly identified." },
    { heading: "Accuracy, pricing and promotion", body: "Do not manipulate prices, hide material charges, bait customers with unavailable stock, misrepresent cultural provenance or make unsupported claims. Advertising and promotions must be identifiable and follow the Promotions and Vouchers Policy." },
    { heading: "Reviews, enforcement and appeal", body: "Do not buy or manipulate reviews or pressure customers. Afrolandx may request corrections, pause or remove listings, cancel affected orders or restrict accounts. Vendors may appeal with evidence through info@afrolandx.com." },
  ],
  "vendor-agreement-and-code-of-conduct": [
    { heading: "Agreement and vendor relationship", body: "The vendor accepts the current marketplace policies and remains an independent seller responsible for its goods, staff, taxes, registrations and lawful operations. Afrolandx may operate platform, payment, verification, shipping and complaint functions." },
    { heading: "Core promises and customer dealings", body: "Sell genuine, lawful goods; describe them accurately; honour accepted orders; communicate respectfully; protect customer data; never pressure customers off-platform or discriminate, harass, threaten or mislead." },
    { heading: "Performance, improvement and enforcement", body: "Meet stated handling, dispatch, response and quality standards. Afrolandx may provide notice or improvement requirements and may remove listings, withhold access, cancel transactions, suspend or close an account where necessary for safety, fraud, performance or compliance." },
    { heading: "Notice, appeal and reinstatement", body: "A vendor may request review within 14 calendar days where a policy channel provides for it, giving relevant evidence. Afrolandx may reinstate access when the underlying risk or breach is adequately addressed." },
    { heading: "Intellectual property, ending and contact", body: "Use only content and marks you may lawfully use. The relationship may end for breach, risk, inactivity, legal requirement or operational reasons; obligations that should continue, including confidentiality and customer-data protection, remain. Contact info@afrolandx.com." },
  ],
  "vendor-onboarding-data-and-account-security": [
    { heading: "Application eligibility", body: "Applicants must be able to sell lawfully, provide accurate information and meet current product, identity, banking and operational requirements. Approval is not guaranteed." },
    { heading: "Information and documents", body: "Afrolandx may request identity, ownership, registration, tax, banking, licensing, location, authorised-user and compliance information and may check official or trusted sources." },
    { heading: "Verification and activation", body: "Afrolandx may request original documents, a call or site visit. Approved vendors must secure the account, change temporary credentials and accept current policies before trading." },
    { heading: "Ongoing verification and data security", body: "Promptly update ownership, bank details, licences, address, contacts and authorised users and complete renewed checks. Customer data may be used only for the relevant order, kept secure, shared only as necessary and retained only as needed." },
    { heading: "Incidents, refusal and appeal", body: "Report any suspected account compromise, loss, security breach or unauthorised disclosure to Afrolandx immediately and no later than 24 hours after becoming aware of it. Preserve relevant records and cooperate with incident handling and rights requests. Afrolandx may refuse, restrict or suspend incomplete, false, expired or risky applications. A vendor may request review within 14 calendar days with supporting evidence. Contact info@afrolandx.com." },
  ],
  "vendor-orders-shipping-returns-and-settlement": [
    { heading: "Packaging and customs", body: "Packaging must protect the item through transport and meet carrier rules. Provide accurate customs description, value, origin, licences and safety documents; never request false declaration or undervaluation." },
    { heading: "Returns and vendor responsibility", body: "Customer eligibility follows the customer-facing Return Policy. Vendors are generally responsible for counterfeit, unsafe, defective, expired, materially misdescribed, incomplete, wrong, inadequately packed or unlawful goods. Remedies may include repair, replacement, return and full refund, including reasonable delivery costs where required." },
    { heading: "Evidence and decisions", body: "Respond to a claim within 2 business days or a shorter urgent-safety period, preserve records and provide listing, dispatch, serial-number, packaging or authenticity evidence. Afrolandx may decide using available evidence if the vendor does not respond. Request review within 14 calendar days." },
    { heading: "Fees and commercial schedule", body: "The dashboard or signed schedule states commission, payment-processing, verification, logistics, storage, advertising and other applicable charges. Afrolandx will not introduce a new material fee retrospectively for completed orders. Vendors remain responsible for applicable taxes, registrations and invoices." },
    { heading: "Settlement and deductions", body: "The dashboard or signed schedule will state any settlement timing and conditions; this policy does not promise a cadence or hold period. Afrolandx may deduct agreed fees, refunds, chargebacks, allocated delivery or return costs, taxes and other sums properly due, and may apply a reasonable reserve for fraud, disputes or unusual returns. If an amount was already settled, it may be deducted from future amounts or repayment requested." },
    { heading: "Settlement queries", body: `Raise a statement query within 30 calendar days with the order number and disputed entry. Afrolandx may correct errors and will give advance notice of material fee changes. Contact ${PAYMENT_EMAIL}.` },
  ],
};

export const policies: Policy[] = basePolicies.map((policy) => ({
  ...policy,
  ...(["prohibited-and-restricted-products", "return-policy"].includes(policy.slug) ? { lastUpdated: "2026-10-09" } : {}),
  sections: [
    ...policy.sections,
    ...(additionalSections[policy.slug] || []),
    ...(policy.slug === "return-policy"
      ? [{ heading: "Refund timing", body: REFUND_TIMELINE }]
      : []),
    ...(["marketplace-terms", "return-policy", "vendor-orders-shipping-returns-and-settlement"].includes(policy.slug)
      ? [{ heading: "Payment support", body: `For payment, refund and payout questions, contact ${PAYMENT_EMAIL}. Include the order or transaction reference. Never email your password, card security code or full bank account details.` }]
      : []),
  ],
}));

export const policyDate = dates;
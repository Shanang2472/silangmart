# Natatangi at Pambihirang Feature ng Silang Mini Mart

## Saklaw ng dokumento

Itinuturing na natatangi ang mga feature na ito batay sa aktwal na code ng Silang Mini Mart. Ang kahulugan ng “unique” dito ay hindi karaniwang makikita sa mga simpleng POS project o kaya ay mahalaga ang kombinasyon ng mga feature sa isang sistema. Kinilala ang mga ito mula sa kasalukuyang sistema at database, hindi mula sa paghahambing sa lahat ng POS platform sa merkado.

## Buod ng mga feature

| # | Feature | Bakit ito natatangi |
|---|---|---|
| 1 | Pinagsamang operasyon ng limang uri ng user | Admin, cashier, customer, rider, at supplier ay may sariling portal sa iisang sistema. |
| 2 | Lokal na paraan ng pagbebenta | May Tingi, Balot, Karton, at Pakyaw para sa isang produkto. |
| 3 | Hakbang-hakbang na proof of delivery | Pinagsasama ang handover, larawan, pagbabayad, at pagsasara ng delivery. |
| 4 | AI assistant na naaayon sa role | Iba ang gabay ng Gemini para sa admin, customer, rider, supplier, at staff. |
| 5 | Supplier delivery at receiving kada branch | Maaaring mag-schedule ang supplier ng delivery na nakatalaga sa partikular na branch. |
| 6 | Interactive na mapa ng Silang at address intelligence | Nagtuturo ng lokasyon, ruta, geocoding, reverse geocoding, at delivery movement. |
| 7 | Integrated value-added services | Naroon ang E-Load, bills payment, remittance, cash-in, receipt, at transaction history sa POS environment. |
| 8 | Real-time role-based notifications | Gumagamit ng Server-Sent Events para maipadala ang notification sa tamang user o role. |
| 9 | Variant inventory kada branch | Maaaring may sariling stock, limit, larawan, at stock alert ang bawat variant sa bawat branch. |
| 10 | Customer/store profile na may larawan at mapa | Maaring i-save ang exact coordinates, address, barangay, at larawan ng tindahan ng customer. |
| 11 | Mga receipt ayon sa uri ng transaksyon | May POS receipt, service receipt, PDF, at delivery receipt modal. |
| 12 | Lokal na Silang/Cavite workflow | Ginagamit ang Taglish, Philippine peso, lokal na barangay, mobile networks, utilities, at remittance providers. |

---

## 1. Pinagsamang operasyon ng limang uri ng user

### Detalye

Hindi lamang cashier POS ang sistema. Ito ay may magkakaugnay na workspace para sa admin o manager, cashier, customer, rider, at supplier. Ang admin ay namamahala ng inventory, staff, branch, sales, deliveries, at analytics. Ang cashier ay gumagawa ng POS transaction. Ang customer ay namimili, nag-o-order, at sumusubaybay ng delivery. Ang rider ay nagdedeliver, nag-update ng status, nagkokolekta ng bayad, at nagsusumite ng proof of delivery. Ang supplier naman ay naglalagay ng delivery plan at item cost.

### Paliwanag sa paggamit

Mas kaunti ang kailangang duplicating data dahil lahat ng user ay gumagana sa iisang produkto, branch, order, inventory, delivery, at payment database. Mas madaling sundan ang produkto mula supplier hanggang sa customer kung hindi hiwalay ang bawat proceso.

### Batayan sa code

May dedicated frontend dashboard para sa customer, rider, at supplier, samantalang ang backend ay may role authorization para sa protected API.

---

## 2. Lokal na paraan ng pagbebenta: Tingi, Balot, Karton, at Pakyaw

### Detalye

Isang produkto ay maaaring ipresenta sa apat na purchasing format:

- **Tingi:** retail o one-piece quantity.
- **Balot:** pack ng anim na unit na may 5% discount.
- **Karton:** box ng 24 na unit na may 10% discount.
- **Pakyaw:** wholesale quantity na 100 na unit na may 15% discount.

### Paliwanag sa paggamit

Nadaragdagan ang pagpipilian ng customer mula ordinaryong retail purchase hanggang wholesale. Ang presyo at quantity ay naaayon sa mga paraan ng pagbili na karaniwan sa sari-sari stores, small retailers, resellers, at maliliit na negosyo sa komunidad.

### Batayan sa code

Ang role-specific prompt ng AI ay eksaktong nagtuturo sa customer tungkol sa apat na selling format, at ang customer store component ay may variant at package quantity logic.

---

## 3. Guided Proof-of-Delivery workflow

### Detalye

Ang pag-complete ng delivery ay nahahati sa apat na mahigpit na hakbang:

1. Kinukumpirma ng rider na na-turn over na ang mga item sa customer.
2. Nag-u-upload ang rider ng proof-of-delivery photo.
3. Kinikilala ang COD o digital payment, kasama ang reference kung kinakailangan.
4. Iri-review ng rider ang detalye bago markahan ang delivery na Delivered.

### Paliwanag sa paggamit

Ang feature na ito ay nakakatulong upang mabawasan ang hindi pagkakaunawaan tungkol sa pagka-deliver ng order at pagtanggap ng bayad. Para sa Cash on Delivery, kinakailangang i-acknowledge ng rider na kanyang binilang ang tamang halaga. Para sa digital payment, maaaring i-record ang reference at status ng gateway.

### Batayan sa code

Ang `ProofOfDeliveryModal.tsx` ay tumatawag ng dedicated endpoints para sa POD photo upload, payment confirmation, at delivery status. Sinusuri ng backend ang payment total, payment method, idempotency, at handover data.

---

## 4. Role-aware Gemini AI assistant

### Detalye

Iba ang instruction ng AI depende sa user role:

- Admin ay tumutulong bilang business advisor para sa inventory at analytics.
- Customer ay tinutulungan bilang Ate Digy upang mamili mula sa aktwal na product catalog.
- Rider ay binibigyan ng dispatch, safety, at route support.
- Staff/cashier ay tinutulungan sa POS, payment, E-Load, bills, at remittance.

### Paliwanag sa paggamit

Mas naaangkop ang sagot sa tungkulin ng gumagamit. Halimbawa, hindi dapat makapag-alok ang chatbot sa customer ng item na wala sa inventory. Para sa admin, mas importante ang actual stock at reporting. Ang AI ay binibigyan ng kasalukuyang system inventory context upang bawasan ang hallucination.

### Batayan sa code

Sa `server.ts`, gumagawa ang system ng magkakaibang Gemini system instruction batay sa logged-in role, idinadagdag ang current data, at pinapatupad ang accuracy rules.

---

## 5. Supplier delivery at receiving kada branch

### Detalye

Maaaring gumawa ang supplier ng delivery plan na naglalaman ng destination branch, delivery date, product, quantity, unit cost, at total cost. Nakikita ito ng admin bago tapusin ang receiving process.

### Paliwanag sa paggamit

Pinag-uugnay ng feature ang supplier commitment sa aktwal na pagtanggap ng branch. Ito ay maaaring makatulong sa pag-audit ng cost, quantity, at supplier, kasama ang pagsasaayos ng inventory pagkatapos ng pag-receive.

### Batayan sa code

Ang `SupplierDashboard.tsx` ay nagtatalaga ng delivery. Ang `src/routes/supplierDeliveries.ts` ay nagha-handle ng creation, authorization, receiving, at branch-specific data.

---

## 6. Interactive delivery map at address intelligence

### Detalye

Gumagamit ang sistema ng Leaflet, OpenStreetMap, at satellite tile para sa mga delivery map. Maaari itong:

- Maghanap ng address o lugar sa Silang.
- Kunin ang address at barangay mula sa map pin.
- Ipakita ang branch, customer, at rider markers.
- Gumamit ng OSRM road route.
- Simulate ang movement ng rider.
- Pumili ng motorcycle, truck, o tricycle.
- Mag-fullscreen sa mapa.

### Paliwanag sa paggamit

Mas tumpak ang lokasyon kaysa typed address lamang. Malaking tulong ito sa lugar na mahirap tukuyin o may parehong pangalan ng address. Nakikita rin ng customer, rider, at admin ang delivery progress sa visual na paraan.

### Batayan sa code

Nakakalaman sa `DeliveryMap.tsx` ang mapa, marker, route, at fullscreen interaction. Gamit ng `src/utils/routeUtils.ts` ang geocoding, reverse geocoding, routing, at equidistant route points.

---

## 7. Integrated value-added services

### Detalye

Maaaring mag-process ang branch ng:

- E-Load at promos para sa Smart, Globe, TNT, at DITO.
- Bills payment para sa utilities.
- Remittance o cash-in para sa mga pelanggan.

Bawat transaction ay may amount, service fee, total amount, timestamp, branch, recipient, account name, provider, at status.

### Paliwanag sa paggamit

Hindi lang ordinaryong retail ang tindahan kundi payment at telecom service center din. Ang pagsasama ng mga ito sa iisang POS environment ay nakakatipid ng oras, nagpapadali sa receipt generation, at nagbibigay ng unified transaction history.

### Batayan sa code

Ginagamit ang `ValueAddedServices.tsx`, service API, `service_transactions` database table, at dedicated service receipt.

---

## 8. Real-time role-scoped notifications

### Detalye

May notification preferences, unread count, mark as read, mark-all-read, deletion, role notification, personal notification, at Server-Sent Events. Nakikita ang aktibong notification ng tamang role o user.

### Paliwanag sa paggamit

Nakatutulong ang real-time alert para malaman kaagad ang bagong order, delivery, o system event nang hindi kailangang mag-refresh. Pinipigilan din nito na makakita ang ibang role ng impormasyong hindi para sa kanila.

### Batayan sa code

Ang notification routes ay may read, delete, preferences, system notification, at SSE stream endpoints. Ang frontend ay may Notification Center at hook para sa real-time update.

---

## 9. Variant-level inventory at imagery kada branch

### Detalye

Ang isang produkto ay maaaring magkaroon ng variants na may sariling pangalan, larawan, stock, minimum stock limit, at branch stock record.

### Paliwanag sa paggamit

Hindi kailangang gamitin ang isang stock quantity para sa lahat ng size, flavor, package, o branch. Mas tama ito para sa inventory kapag magkaiba ang demand, replenishment, o kailangan sa bawat branch.

### Batayan sa code

Ang database schema ay may `product_variants` at `product_stock`. May product routes para sa variant image upload, branch stock update, inventory adjustment, at bulk stock limits.

---

## 10. Customer/store profile na may larawan at location pin

### Detalye

Maaaring mag-save ang customer ng address, barangay, exact latitude/longitude, contact number, at larawan ng tindahan o store. May map pin rin na ginagamit para tukuyin ang delivery location.

### Paliwanag sa paggamit

Kapaki-pakinabang ito sa rural o mixed-use na lugar kung saan mahirap hanapin ang address. Makakatulong ang larawan upang matukoy ang building, bahay, o business, lalo na para sa rider.

### Batayan sa code

May customer profile, image upload, coordinates, at map location selection sa frontend. Ginagamit ng rider ang coordinate at store image habang naghahatid.

---

## 11. Receipt-oriented completion controls

### Detalye

May hiwalay na flow para sa POS receipt, value-added service receipt, delivery receipt, at proof-of-delivery record. Maaaring i-print o i-generate bilang PDF ang transaction proof.

### Paliwanag sa paggamit

Mas tiyak ang customer verification kung malinaw ang items, item subtotal, service fee, total amount, delivery information, at payment method.

### Batayan sa code

Gumagamit ang app ng jsPDF, QRCode, `DeliveryReceiptModal.tsx`, service receipt UI, at POS receipt components.

---

## 12. Lokal na Silang/Cavite operational context

### Detalye

May Taglish interface, Philippine peso, lokal na barangay, common Philippine telecom network, utility companies, Silang address convention, rider terminology, at remittance providers.

### Paliwanag sa paggamit

Mas madaling gamitin ng lokal na customer, staff, rider, at supplier ang sistemang gumagamit ng kanilang familiar na provider, terminology, currency, at delivery context.

### Batayan sa code

Makikita ang lokal na context sa UI, route assumptions, seed location, provider list, AI prompt, address, at map implementation.

---

## Mga pinakamalakas na natatanging kombinasyon

Para sa thesis o system presentation, maaaring ipakita ang mga ito bilang malalakas na selling points:

1. **Iisang system para sa POS, customer, rider, supplier, at admin.**
2. **Proof of delivery at COD/digital payment confirmation sa parehong flow.**
3. **Tingi, Balot, Karton, at Pakyaw na may inventory-aware AI.**
4. **Branch-specific supplier receiving at variant inventory.**
5. **Local maps, geocoding, live delivery tracking, at real-time notifications.**
6. **E-Load, bills payment, at remittance na integrated sa mini-mart operations.**

Mas malakas ang pagpapaliwanag kung ipakikita na ito ay isang whole-system solution para sa mini-mart, hindi lamang isang collection ng mga technology.

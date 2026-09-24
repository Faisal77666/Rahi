import { useEffect, useRef, useState } from "react";
import {
  Bell,
  Car,
  CheckCircle2,
  CircleUserRound,
  Clock3,
  Plus,
  ReceiptText,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";
import PassengerSidebar from "./PassengerSidebar";
import { SoundToggle, useNotificationSound } from "../../notifications/NotificationSoundProvider";
import ChatPanel from "../chat/ChatPanel";
import { useRahiSocket } from "../../realtime/SocketProvider";

const routes = ["Lahore-Pattoki", "Pattoki-Lahore"];
const formatDate = (value) =>
  new Date(value).toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
  });
const dateKey = (value) => new Date(value).toISOString().slice(0, 10);
const pakistanDateKey = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const pakistanFutureDeparture = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(Date.now() + 30 * 60 * 1000));
  const value = (type) => parts.find((part) => part.type === type)?.value;
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    time: `${value("hour")}:${value("minute")}`,
  };
};

const requestPresentation = (status) =>
  ({
    pending: {
      Icon: Clock3,
      label: "Waiting for driver",
      colors: "bg-amber-50 text-amber-700",
    },
    accepted: {
      Icon: CheckCircle2,
      label: "Accepted",
      colors: "bg-emerald-50 text-emerald-700",
    },
    rejected: {
      Icon: XCircle,
      label: "Rejected",
      colors: "bg-rose-50 text-rose-700",
    },
    cancelled: {
      Icon: XCircle,
      label: "Ride cancelled",
      colors: "bg-slate-100 text-slate-600",
    },
  })[status] || {
    Icon: Clock3,
    label: status,
    colors: "bg-slate-100 text-slate-600",
  };

function TripRequestModal({ onClose, onSubmit, saving, error }) {
  const defaultDeparture = pakistanFutureDeparture();
  const [form, setForm] = useState({
    route: "Lahore-Pattoki",
    date: defaultDeparture.date,
    time: defaultDeparture.time,
    offeredPrice: "",
  });
  const update = (event) =>
    setForm({ ...form, [event.target.name]: event.target.value });
  const futureTravel =
    form.time && new Date(`${form.date}T${form.time}:00+05:00`) > new Date();
  const submit = (event) => {
    event.preventDefault();
    if (!futureTravel || saving) return;
    onSubmit({
      ...form,
      offeredPrice: Number(form.offeredPrice),
    });
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-teal-700">
              Passenger trip request
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              Request a driver
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Drivers will see your desired trip and offered fare.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-lg text-slate-500"
          >
            <X size={20} />
          </button>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            Route
            <select
              name="route"
              value={form.route}
              onChange={update}
              className="mt-1.5 w-full rounded-lg border border-slate-200 p-2.5"
            >
              <option>Lahore-Pattoki</option>
              <option>Pattoki-Lahore</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Travel date
            <input
              name="date"
              type="date"
              min={pakistanDateKey()}
              value={form.date}
              onChange={update}
              className="mt-1.5 w-full rounded-lg border border-slate-200 p-2.5"
              required
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Desired departure time
            <input
              name="time"
              type="time"
              value={form.time}
              onChange={update}
              className="mt-1.5 w-full rounded-lg border border-slate-200 p-2.5"
              required
            />
          </label>
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
            Your offered full-ride fare (PKR)
            <input
              name="offeredPrice"
              type="number"
              min="0"
              value={form.offeredPrice}
              onChange={update}
              className="mt-1.5 w-full rounded-lg border border-slate-200 p-2.5"
              placeholder="e.g. 700"
              required
            />
          </label>
        </div>
        {form.time && !futureTravel && (
          <p className="mt-4 text-sm font-medium text-rose-600">
            Choose a travel time in the future.
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            {error}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !futureTravel}
            className="rounded-lg px-4 py-2.5 text-sm font-semibold"
            style={{
              backgroundColor: saving || !futureTravel ? "#cbd5e1" : "#0d9488",
              color: "#fff",
            }}
          >
            {saving ? "Sending…" : "Send driver request"}
          </button>
        </div>
      </form>
    </div>
  );
}

function MyTripRequestList({ tripRequests, acceptingOfferId, onAcceptOffer, onOpenChat }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-700">
          <Car size={20} />
        </span>
        <div>
          <h2 className="font-bold text-slate-900">My driver requests</h2>
          <p className="mt-1 text-sm text-slate-500">
            Compare driver offers and choose one.
          </p>
        </div>
      </div>
      {tripRequests.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">
          You have not requested a driver yet.
        </p>
      ) : (
        <div className="space-y-4">
          {tripRequests.map((trip) => (
            <article
              key={trip._id}
              className="rounded-xl border border-slate-200 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-800">{trip.route}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {formatDate(trip.date)} · {trip.time}
                  </p>
                  <p className="mt-1 text-sm text-teal-700">
                    Your offer: PKR {trip.offeredPrice} full ride
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-sm font-semibold ${trip.status === "accepted" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                >
                  {trip.status === "accepted"
                    ? "Driver selected"
                    : "Waiting for offers"}
                </span>
              </div>
              {trip.offers?.length > 0 ? (
                <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                  {trip.offers.map((offer) => (
                    <div
                      key={offer._id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {offer.driverId?.name}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {offer.type === "accepted"
                            ? "Accepted your offered fare"
                            : `Counter-offer: PKR ${offer.amount} full ride`}
                        </p>
                        {trip.status === "accepted" &&
                          offer.status === "accepted" && (
                            <><p className="mt-1 text-sm font-semibold text-teal-700">Agreed full-ride fare: PKR {offer.amount}</p><p className="mt-1 text-sm font-medium text-teal-700">Driver phone: {offer.driverId?.phone}</p></>
                          )}
                      </div>
                      {trip.status === "open" && offer.status === "pending" && (
                        <button
                          type="button"
                          disabled={acceptingOfferId === offer._id}
                          onClick={() => onAcceptOffer(trip._id, offer._id)}
                          className="rounded-lg px-3 py-2 text-sm font-semibold"
                          style={{ backgroundColor: "#0d9488", color: "#fff" }}
                        >
                          {acceptingOfferId === offer._id
                            ? "Accepting…"
                            : "Choose driver"}
                        </button>
                      )}
                      {trip.status === "accepted" && offer.status === "accepted" && (
                        <button
                          type="button"
                          onClick={() => onOpenChat(trip._id)}
                          className="rounded-lg px-3 py-2 text-sm font-semibold"
                          style={{ backgroundColor: "#0d9488", color: "#fff" }}
                        >
                          Open chat
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">
                  No driver offers yet.
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default function PassengerDashboard({ session, api }) {
  const { play } = useNotificationSound();
  const socket = useRahiSocket();
  const [activeTab, setActiveTab] = useState("explore");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [route, setRoute] = useState(routes[0]);
  const [travelDate, setTravelDate] = useState(
    pakistanDateKey(),
  );
  const [travelTime, setTravelTime] = useState("");
  const [rides, setRides] = useState([]);
  const [requests, setRequests] = useState([]);
  const [seatOffers, setSeatOffers] = useState({});
  const [tripRequests, setTripRequests] = useState([]);
  const [notice, setNoticeText] = useState("");
  const setNotice = (message) => {
    setNoticeText(message);
    if (!message) return;
    const sound = /(reject|cancel|error|unable|fail)/i.test(message)
      ? "request_rejected"
      : /(accept|confirm|success)/i.test(message)
        ? "request_accepted"
        : "new_request";
    play(sound);
  };
  const [loading, setLoading] = useState(true);
  const [rideToast, setRideToast] = useState(null);
  const [tripRequestOpen, setTripRequestOpen] = useState(false);
  const [sendingTripRequest, setSendingTripRequest] = useState(false);
  const [tripRequestError, setTripRequestError] = useState("");
  const [acceptingOfferId, setAcceptingOfferId] = useState("");
  const [chatTripId, setChatTripId] = useState("");
  const knownRideIds = useRef({ route: null, ids: new Set() });
  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const tripRequestData = await api("/trip-requests/mine", { token: session.token });
      setRides([]);
      setRequests([]);
      setTripRequests(tripRequestData.tripRequests);
    } catch (error) {
      setNotice(error.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, [route]);
  useEffect(() => {
    const id = window.setInterval(() => load(true), 10000);
    return () => window.clearInterval(id);
  }, [route]);
  useEffect(() => {
    if (!socket) return undefined;
    const openConfirmedTripChat = ({ tripRequestId }) => {
      if (!tripRequestId) return;
      setChatTripId(String(tripRequestId));
      setActiveTab("chat");
      load(true);
    };
    socket.on("request_accepted", openConfirmedTripChat);
    return () => socket.off("request_accepted", openConfirmedTripChat);
  }, [socket]);
  useEffect(() => {
    if (!rideToast) return undefined;
    const id = window.setTimeout(() => setRideToast(null), 7000);
    return () => window.clearTimeout(id);
  }, [rideToast]);
  useEffect(() => {
    const closeDrawer = () => {
      if (window.innerWidth >= 768) setMobileOpen(false);
    };
    closeDrawer();
    window.addEventListener("resize", closeDrawer);
    return () => window.removeEventListener("resize", closeDrawer);
  }, []);
  useEffect(() => {
    const openRequestedTab = () => {
      if (window.location.hash === "#requests") setActiveTab("requests");
    };
    openRequestedTab();
    window.addEventListener("hashchange", openRequestedTab);
    return () => window.removeEventListener("hashchange", openRequestedTab);
  }, []);
  const requestSeat = async (rideId, askingPrice) => {
    const proposedPrice = Number(seatOffers[rideId]);
    if (!Number.isFinite(proposedPrice) || proposedPrice < 0) {
      setNotice("Enter your per-seat offer before sending the request.");
      return;
    }
    try {
      await api("/requests", {
        token: session.token,
        method: "POST",
        body: JSON.stringify({ rideId, proposedPrice }),
      });
      setSeatOffers((current) => ({ ...current, [rideId]: "" }));
      setNotice(
        proposedPrice === askingPrice
          ? "Seat request sent at the driver’s asking fare."
          : "Your per-seat counter-offer was sent to the driver.",
      );
      load(true);
    } catch (error) {
      setNotice(error.message);
    }
  };
  const createTripRequest = async (details) => {
    setSendingTripRequest(true);
    setTripRequestError("");
    try {
      await api("/trip-requests", {
        token: session.token,
        method: "POST",
        body: JSON.stringify(details),
      });
      setTripRequestOpen(false);
      setNotice("Your driver request is now visible to drivers.");
      load(true);
    } catch (error) {
      setNotice(error.message);
      setTripRequestError(error.message);
    } finally {
      setSendingTripRequest(false);
    }
  };
  const acceptTripOffer = async (tripId, offerId) => {
    setAcceptingOfferId(offerId);
    try {
      const result = await api(
        `/trip-requests/${tripId}/offers/${offerId}/accept`,
        {
          token: session.token,
          method: "PATCH",
        },
      );
      setNotice(
        `Driver selected. Phone: ${result.contactDetails.driver.phone}`,
      );
      setChatTripId(tripId);
      setActiveTab("chat");
      load(true);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setAcceptingOfferId("");
    }
  };
  const acceptDriverFare = async (requestId) => {
    try {
      const result = await api(`/requests/${requestId}/accept-driver-fare`, {
        token: session.token,
        method: "PATCH",
      });
      setNotice(`Seat confirmed. Driver phone: ${result.contactDetails.driver.phone}`);
      load(true);
    } catch (error) {
      setNotice(error.message);
    }
  };
  const logout = () => {
    localStorage.removeItem("drivoSession");
    window.location.reload();
  };
  const matchingRides = rides.filter(
    (ride) =>
      (!travelDate || dateKey(ride.date) === travelDate) &&
      (!travelTime || ride.time >= travelTime),
  );
  const explore = (
    <>
      <section className="rounded-2xl border border-teal-100 bg-teal-50 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-teal-700">
              Need a ride that is not listed?
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              Request a driver for your preferred time
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Set your route, time, seats, and fare. Drivers can respond
              directly.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setTripRequestError("");
              setTripRequestOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold"
            style={{ backgroundColor: "#0d9488", color: "#fff" }}
          >
            <Plus size={18} />
            Request a driver
          </button>
        </div>
      </section>
      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-bold text-slate-900">
              When do you want to travel?
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Set your preferred departure time to find a suitable ride.
            </p>
          </div>
          <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-3">
            <label className="text-sm font-semibold text-slate-700">
              Route
              <select
                value={route}
                onChange={(event) => setRoute(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white p-2.5"
              >
                {routes.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Travel date
              <input
                type="date"
                min={pakistanDateKey()}
                value={travelDate}
                onChange={(event) => setTravelDate(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white p-2.5"
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              Earliest departure
              <input
                type="time"
                value={travelTime}
                onChange={(event) => setTravelTime(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white p-2.5"
              />
            </label>
          </div>
        </div>
      </section>
      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Available rides</h2>
            <p className="mt-1 text-sm text-slate-500">
              New rides refresh automatically every 10 seconds.
            </p>
          </div>
          {travelTime && (
            <button
              type="button"
              onClick={() => setTravelTime("")}
              className="text-sm font-semibold text-teal-700"
            >
              Clear time
            </button>
          )}
        </div>
        {loading ? (
          <p className="py-10 text-center text-sm text-slate-500">
            Loading rides…
          </p>
        ) : matchingRides.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">
            No rides match this travel date and time yet.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {matchingRides.map((ride) => (
              (() => {
                const existingRequest = requests.find(
                  (request) => request.rideId?._id === ride._id,
                );
                const rideUnavailable = ride.seatsAvailable === 0;
                return (
              <article
                key={ride._id}
                className="flex flex-wrap items-center justify-between gap-4 py-5"
              >
                <div className="flex gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-700">
                    <Car size={20} />
                  </span>
                  <div>
                    <p className="font-semibold text-slate-800">{ride.route}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {formatDate(ride.date)} · {ride.time} ·{" "}
                      {ride.driverId?.name}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {ride.rideType === "private"
                        ? "Private ride · 1 passenger"
                        : `${ride.seatsAvailable}/${ride.seatsTotal} seats available`}{" "}
                      · PKR {ride.pricePerSeat}
                      {ride.rideType === "private" ? " full ride" : " per seat"}
                    </p>
                  </div>
                </div>
                {existingRequest?.status === "rejected" ? (
                  <button
                    type="button"
                    disabled={rideUnavailable}
                    onClick={() => acceptDriverFare(existingRequest._id)}
                    className="rounded-lg px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: rideUnavailable ? "#cbd5e1" : "#0d9488",
                      color: "#fff",
                    }}
                  >
                    Accept PKR {ride.pricePerSeat}
                  </button>
                ) : existingRequest ? (
                  <span
                    className={`rounded-full px-3 py-2 text-sm font-semibold ${existingRequest.status === "accepted" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                  >
                    {existingRequest.status === "accepted"
                      ? "Seat confirmed"
                      : "Offer pending"}
                  </span>
                ) : (
                  <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
                    <input
                      type="number"
                      min="0"
                      value={seatOffers[ride._id] ?? ""}
                      onChange={(event) =>
                        setSeatOffers((current) => ({
                          ...current,
                          [ride._id]: event.target.value,
                        }))
                      }
                      placeholder={`Offer PKR ${ride.pricePerSeat}`}
                      className="w-36 rounded-lg border border-slate-200 p-2.5 text-sm"
                      disabled={rideUnavailable}
                      aria-label="Your per-seat offer in PKR"
                    />
                    <button
                      type="button"
                      disabled={rideUnavailable}
                      onClick={() => requestSeat(ride._id, ride.pricePerSeat)}
                      className="rounded-lg px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed"
                      style={{
                        backgroundColor: rideUnavailable ? "#cbd5e1" : "#0d9488",
                        color: "#fff",
                      }}
                    >
                      Send offer
                    </button>
                  </div>
                )}
              </article>
                );
              })()
            ))}
          </div>
        )}
      </section>
    </>
  );
  const requestList = (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-700">
            <ReceiptText size={20} />
          </span>
          <div>
            <h2 className="font-bold text-slate-900">My requests</h2>
            <p className="mt-1 text-sm text-slate-500">
              Track every ride request in one place.
            </p>
          </div>
        </div>
        {requests.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">
            You have not requested a ride yet.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {requests.map((request) => {
              const { Icon, label, colors } = requestPresentation(
                request.status,
              );
              return (
                <article
                  key={request._id}
                  className="flex flex-wrap items-center justify-between gap-4 py-5"
                >
                  <div>
                    <p className="font-semibold text-slate-800">
                      {request.rideId?.route || "Ride unavailable"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {request.rideId?.date
                        ? `${formatDate(request.rideId.date)} · ${request.rideId.time}`
                        : "This ride is no longer active"}
                    </p>
                    <p className="mt-1 text-sm text-teal-700">
                      Your offer: PKR {request.proposedPrice ?? request.rideId?.pricePerSeat} / seat
                    </p>
                    {request.status === "accepted" && (
                      <p className="mt-1 text-sm font-medium text-teal-700">
                        Driver phone: {request.rideId?.driverId?.phone}
                      </p>
                    )}
                    {request.status === "rejected" && request.rideId && (
                      <button
                        type="button"
                        onClick={() => acceptDriverFare(request._id)}
                        className="mt-3 rounded-lg px-3 py-2 text-sm font-semibold"
                        style={{ backgroundColor: "#0d9488", color: "#fff" }}
                      >
                        Accept driver fare · PKR {request.rideId.pricePerSeat}
                      </button>
                    )}
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${colors}`}
                  >
                    <Icon size={16} />
                    {label}
                  </span>
                </article>
              );
            })}
          </div>
        )}
      </section>
      <MyTripRequestList
        tripRequests={tripRequests}
        acceptingOfferId={acceptingOfferId}
        onAcceptOffer={acceptTripOffer}
        onOpenChat={(tripId) => { setChatTripId(tripId); setActiveTab("chat"); }}
      />
    </div>
  );
  const privateRequestHome = <section className="rounded-2xl border border-teal-100 bg-teal-50 p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-semibold text-teal-700">Private trip request</p><h2 className="mt-1 text-xl font-bold text-slate-900">Request a driver for your preferred time</h2><p className="mt-1 text-sm text-slate-600">Choose your route, departure time, and full-ride offer. No shared seats or ride listings.</p></div><button type="button" onClick={() => { setTripRequestError(''); setTripRequestOpen(true); }} className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold" style={{ backgroundColor: '#0d9488', color: '#fff' }}><Plus size={18} />Request a driver</button></div></section>;
  const privateRequestList = <MyTripRequestList tripRequests={tripRequests} acceptingOfferId={acceptingOfferId} onAcceptOffer={acceptTripOffer} onOpenChat={(tripId) => { setChatTripId(tripId); setActiveTab('chat'); }} />;
  const profile = (
    <section className="max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <CircleUserRound className="text-teal-600" size={34} />
      <h2 className="mt-4 text-xl font-bold text-slate-900">
        {session.user.name}
      </h2>
      <p className="mt-2 text-sm text-slate-500">{session.user.phone}</p>
      <p className="mt-1 text-sm text-slate-500">Passenger account</p>
    </section>
  );
  return (
    <main className="min-h-[100dvh] bg-slate-50">
      <PassengerSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        mobileOpen={mobileOpen}
        onMobileOpen={setMobileOpen}
        onLogout={logout}
      />
      <div className="min-h-screen p-4 pt-20 sm:p-6 sm:pt-20 md:ml-72 md:p-8">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-teal-700">
              Passenger dashboard
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {activeTab === "explore"
                ? "Find your ride"
                : activeTab === "requests"
                  ? "My requests"
                  : "Profile"}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <SoundToggle />
            <button
              aria-label="Notifications"
              className="relative grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm"
            >
              <Bell size={19} />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-teal-500" />
            </button>
            <div className="hidden text-right sm:block">
              <p className="text-sm font-bold text-slate-800">
                {session.user.name}
              </p>
              <p className="text-xs text-slate-500">Passenger</p>
            </div>
            <span className="grid h-10 w-10 place-items-center rounded-full bg-slate-200 text-slate-600">
              <CircleUserRound size={24} />
            </span>
          </div>
        </header>
        {notice && (
          <p className="mb-5 rounded-xl bg-teal-50 px-4 py-3 text-sm font-medium text-teal-800">
            {notice}
          </p>
        )}
        {activeTab === "explore"
          ? privateRequestHome
          : activeTab === "requests"
            ? privateRequestList
            : activeTab === "chat"
              ? <ChatPanel tripRequestId={chatTripId} session={session} api={api} />
            : profile}
      </div>
      {rideToast && (
        <aside className="fixed right-4 top-4 z-50 w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-teal-100 bg-white p-4 shadow-xl shadow-slate-900/15">
          <div className="flex gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700">
              <Sparkles size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-slate-900">
                {rideToast.count > 1
                  ? `${rideToast.count} new rides available`
                  : "New ride available"}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {rideToast.ride.route} · {rideToast.ride.time} · PKR{" "}
                {rideToast.ride.pricePerSeat}
              </p>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("explore");
                  setRideToast(null);
                }}
                className="mt-2 text-sm font-semibold text-teal-700"
              >
                View ride
              </button>
            </div>
            <button
              type="button"
              onClick={() => setRideToast(null)}
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-400"
              aria-label="Dismiss notification"
            >
              <X size={18} />
            </button>
          </div>
        </aside>
      )}
      {tripRequestOpen && (
        <TripRequestModal
          onClose={() => {
            if (sendingTripRequest) return;
            setTripRequestOpen(false);
            setTripRequestError("");
          }}
          onSubmit={createTripRequest}
          saving={sendingTripRequest}
          error={tripRequestError}
        />
      )}
    </main>
  );
}

// Also known as boost.

import type { Object } from 'wildebeest/backend/src/activitypub/objects'
import type { Actor, Person } from 'wildebeest/backend/src/activitypub/actors'
import { getResultsField } from './utils'
import { addObjectInOutbox } from '../activitypub/actors/outbox'
import { sendReblogNotification } from './notification'
import type { JWK } from '../webpush/jwk'

type ReblogNotificationDetails = {
	target: Person
	notifId: string
	adminEmail: string
	vapidKeys: JWK
}

/**
 * Creates a reblog, inserts it in the reblog author's outbox and optionally sends a notification
 * to the original author
 *
 * @param db D1Database
 * @param actor Reblogger
 * @param obj Object to reblog
 * @param notificationDetails optional details for the sending of the notification
 */
export async function createReblog(
	db: D1Database,
	actor: Actor,
	obj: Object,
	notificationDetails?: ReblogNotificationDetails
) {
	const promises = [addObjectInOutbox(db, actor, obj), insertReblog(db, actor, obj)]
	if (notificationDetails) {
		const { target, notifId, adminEmail, vapidKeys } = notificationDetails
		promises.push(sendReblogNotification(db, actor, target, notifId, adminEmail, vapidKeys))
	}

	await Promise.all(promises)
}

export async function insertReblog(db: D1Database, actor: Actor, obj: Object) {
	const id = crypto.randomUUID()

	const query = `
		INSERT INTO actor_reblogs (id, actor_id, object_id)
		VALUES (?, ?, ?)
	`

	const out = await db.prepare(query).bind(id, actor.id.toString(), obj.id.toString()).run()
	if (!out.success) {
		throw new Error('SQL error: ' + out.error)
	}
}

export function getReblogs(db: D1Database, obj: Object): Promise<Array<string>> {
	const query = `
		SELECT actor_id FROM actor_reblogs WHERE object_id=?
	`

	const statement = db.prepare(query).bind(obj.id.toString())

	return getResultsField(statement, 'actor_id')
}
